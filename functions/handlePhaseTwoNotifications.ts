import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

function normalize(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function replaceTemplateVariables(text, variables = {}) {
  let result = normalize(text);
  Object.entries(variables).forEach(([key, value]) => {
    const safeValue = normalize(value);
    result = result.split(`{${key}}`).join(safeValue);
    result = result.split(`{{${key}}}`).join(safeValue);
  });
  return result;
}

function getPersonName(person = {}) {
  if (person.first_name && person.last_name) return `${person.first_name} ${person.last_name}`;
  return person.full_name || person.email || 'Usuario';
}

async function getAppConfig(base44) {
  const rows = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
  return rows?.[0] || {};
}

async function getEmailTemplate(base44, name) {
  const rows = await base44.asServiceRole.entities.EmailTemplate.filter({ name }, '-updated_date', 1);
  return rows?.[0] || null;
}

async function createEmailLog(base44, { to, subject, body, fromName, status = 'sent' }) {
  if (!to || !subject) return;
  await base44.asServiceRole.entities.EmailLog.create({
    recipient_email: to,
    recipient_name: null,
    sender_email: null,
    from_name: fromName,
    subject,
    body_preview: normalize(body).slice(0, 200),
    source: 'manual',
    status,
    sent_date: new Date().toISOString(),
  });
}

async function createNotification(base44, {
  userEmail,
  title,
  message,
  type = 'system',
  icon = 'bell',
  priority = 'medium',
  referenceId = '',
}) {
  if (!userEmail || !title) return;

  const recent = await base44.asServiceRole.entities.Notification.filter({
    user_email: userEmail,
    title,
    reference_id: normalize(referenceId),
  }, '-created_date', 1);

  if (recent?.[0]) {
    const diffMs = Date.now() - new Date(recent[0].created_date).getTime();
    if (diffMs < 15000) return;
  }

  await base44.asServiceRole.entities.Notification.create({
    user_email: userEmail,
    title,
    message,
    type,
    priority,
    reference_id: normalize(referenceId),
    entity_type: 'System',
    icon,
    read: false,
  });
}

async function sendEmail(base44, {
  to,
  templateName,
  fallbackSubject,
  fallbackBody,
  variables = {},
}) {
  if (!to) return { sent: false };

  const appConfig = await getAppConfig(base44);
  const fromName = appConfig.invoice_company_name || appConfig.app_name || 'TLEC CARGO';
  const template = templateName ? await getEmailTemplate(base44, templateName) : null;
  const subject = replaceTemplateVariables(template?.subject || fallbackSubject, variables);
  const body = replaceTemplateVariables(template?.body || fallbackBody, variables);

  try {
    await base44.integrations.Core.SendEmail({
      to,
      subject,
      body,
      from_name: fromName,
    });

    await createEmailLog(base44, { to, subject, body, fromName, status: 'sent' });

    if (template?.id) {
      await base44.asServiceRole.entities.EmailTemplate.update(template.id, {
        usage_count: Number(template.usage_count || 0) + 1,
      });
    }

    return { sent: true, subject, body };
  } catch (error) {
    await createEmailLog(base44, { to, subject, body, fromName, status: 'failed' });
    return { sent: false, error: error?.message || String(error), subject, body };
  }
}

async function getAdmins(base44) {
  return await base44.asServiceRole.entities.User.filter({ role: 'admin' }, '-updated_date', 200);
}

async function notifyAdmins(base44, payload) {
  const admins = await getAdmins(base44);
  await Promise.all((admins || []).map(async (admin) => {
    await createNotification(base44, {
      userEmail: admin.email,
      ...payload,
    });
  }));
}

async function handleUserNotification(base44, eventType, userData, oldData) {
  const email = userData?.email;
  const fullName = getPersonName(userData);
  const profileCompletedNow = !!userData?.profile_completed;
  const profileCompletedBefore = !!oldData?.profile_completed;
  const shippingMarkNow = normalize(userData?.shipping_mark);
  const shippingMarkBefore = normalize(oldData?.shipping_mark);

  if ((eventType === 'create' && profileCompletedNow) || (eventType === 'update' && !profileCompletedBefore && profileCompletedNow)) {
    const variables = {
      cliente_nombre: fullName,
      app_name: 'TLEC CARGO',
    };

    await sendEmail(base44, {
      to: email,
      templateName: 'Base - Nuevo Cliente',
      fallbackSubject: '¡Bienvenido a TLEC CARGO!',
      fallbackBody: 'Hola {cliente_nombre}, tu cuenta ya está activa en TLEC CARGO.',
      variables,
    });

    await notifyAdmins(base44, {
      title: 'Nuevo cliente registrado',
      message: `${fullName} completó su perfil (${email}).`,
      icon: 'alert',
      priority: 'high',
      referenceId: userData?.id,
    });
  }

  if (eventType === 'update' && shippingMarkNow && shippingMarkNow !== shippingMarkBefore) {
    const variables = {
      cliente_nombre: fullName,
      shipping_mark: shippingMarkNow,
    };

    await sendEmail(base44, {
      to: email,
      templateName: 'Base - Shipping Mark Asignado',
      fallbackSubject: 'Tu Shipping Mark ha sido asignado',
      fallbackBody: 'Hola {cliente_nombre}, tu Shipping Mark es {shipping_mark}.',
      variables,
    });

    await createNotification(base44, {
      userEmail: email,
      title: 'Shipping Mark asignado',
      message: `Tu código asignado es ${shippingMarkNow}.`,
      icon: 'check',
      priority: 'high',
      referenceId: userData?.id,
    });
  }

  return { ok: true, entity: 'User' };
}

async function handleInvoiceNotification(base44, eventType, invoiceData, oldData) {
  const clientEmail = invoiceData?.client_email;
  const invoiceNumber = invoiceData?.invoice_number || invoiceData?.id;
  const currentStatus = normalize(invoiceData?.status);
  const previousStatus = normalize(oldData?.status);
  const clientRows = clientEmail
    ? await base44.asServiceRole.entities.User.filter({ email: clientEmail }, '-updated_date', 1)
    : [];
  const client = clientRows?.[0] || { email: clientEmail };
  const clientName = getPersonName(client);

  if (eventType === 'create') {
    const variables = {
      cliente_nombre: clientName,
      invoice_number: invoiceNumber,
      total: invoiceData?.total,
    };

    await sendEmail(base44, {
      to: clientEmail,
      templateName: 'Base - Factura Generada',
      fallbackSubject: 'Nueva factura disponible: {invoice_number}',
      fallbackBody: 'Hola {cliente_nombre}, se generó la factura {invoice_number} por un total de {total}.',
      variables,
    });

    await createNotification(base44, {
      userEmail: clientEmail,
      title: 'Nueva factura disponible',
      message: `Tu factura ${invoiceNumber} ya está disponible por ${invoiceData?.total || 0}.`,
      icon: 'dollar',
      priority: 'high',
      referenceId: invoiceData?.id,
    });

    await notifyAdmins(base44, {
      title: 'Factura generada',
      message: `Se creó la factura ${invoiceNumber} para ${clientEmail}.`,
      icon: 'dollar',
      priority: 'medium',
      referenceId: invoiceData?.id,
    });
  }

  if (eventType === 'update' && currentStatus && currentStatus !== previousStatus) {
    const templateName = currentStatus === 'pagada'
      ? 'Base - Factura Pagada'
      : currentStatus === 'vencida'
        ? 'Base - Factura Vencida'
        : '';

    const fallbackSubject = currentStatus === 'pagada'
      ? 'Pago confirmado para la factura {invoice_number}'
      : currentStatus === 'vencida'
        ? 'Factura vencida: {invoice_number}'
        : 'Actualización de factura: {invoice_number}';

    const fallbackBody = currentStatus === 'pagada'
      ? 'Hola {cliente_nombre}, confirmamos el pago de la factura {invoice_number}.'
      : currentStatus === 'vencida'
        ? 'Hola {cliente_nombre}, la factura {invoice_number} se encuentra vencida.'
        : 'Hola {cliente_nombre}, la factura {invoice_number} cambió a estado {status}.';

    const variables = {
      cliente_nombre: clientName,
      invoice_number: invoiceNumber,
      status: currentStatus,
    };

    await sendEmail(base44, {
      to: clientEmail,
      templateName,
      fallbackSubject,
      fallbackBody,
      variables,
    });

    await createNotification(base44, {
      userEmail: clientEmail,
      title: 'Estado de factura actualizado',
      message: `La factura ${invoiceNumber} ahora está ${currentStatus}.`,
      icon: currentStatus === 'pagada' ? 'check' : 'dollar',
      priority: currentStatus === 'vencida' ? 'high' : 'medium',
      referenceId: invoiceData?.id,
    });

    await notifyAdmins(base44, {
      title: 'Factura actualizada',
      message: `La factura ${invoiceNumber} cambió de ${previousStatus || 'sin estado'} a ${currentStatus}.`,
      icon: currentStatus === 'pagada' ? 'check' : 'dollar',
      priority: currentStatus === 'vencida' ? 'high' : 'medium',
      referenceId: invoiceData?.id,
    });
  }

  return { ok: true, entity: 'Invoice' };
}

async function handleAssistedPaymentNotification(base44, eventType, requestData, oldData) {
  const clientEmail = requestData?.client_email;
  const requestRef = requestData?.reference || requestData?.id;
  const currentStatus = normalize(requestData?.status || 'pendiente');
  const previousStatus = normalize(oldData?.status);
  const clientRows = clientEmail
    ? await base44.asServiceRole.entities.User.filter({ email: clientEmail }, '-updated_date', 1)
    : [];
  const client = clientRows?.[0] || { email: clientEmail };
  const clientName = getPersonName(client);

  if (eventType === 'create') {
    await sendEmail(base44, {
      to: clientEmail,
      templateName: 'Base - Solicitud Pago Asistido',
      fallbackSubject: 'Recibimos tu solicitud de pago asistido',
      fallbackBody: 'Hola {cliente_nombre}, recibimos tu solicitud de pago asistido y pronto la revisaremos.',
      variables: {
        cliente_nombre: clientName,
      },
    });

    await createNotification(base44, {
      userEmail: clientEmail,
      title: 'Solicitud de pago asistido recibida',
      message: 'Tu solicitud fue enviada correctamente y está pendiente de revisión.',
      icon: 'dollar',
      priority: 'medium',
      referenceId: requestData?.id,
    });

    await notifyAdmins(base44, {
      title: 'Nueva solicitud de pago asistido',
      message: `${clientName} creó una solicitud por ${requestData?.total_amount || requestData?.amount || 0}.`,
      icon: 'alert',
      priority: 'high',
      referenceId: requestData?.id,
    });
  }

  if (eventType === 'update' && currentStatus && currentStatus !== previousStatus) {
    await sendEmail(base44, {
      to: clientEmail,
      fallbackSubject: 'Actualización de tu pago asistido',
      fallbackBody: 'Hola {cliente_nombre}, tu solicitud {reference} cambió a estado {status}.',
      variables: {
        cliente_nombre: clientName,
        reference: requestRef,
        status: currentStatus,
      },
    });

    await createNotification(base44, {
      userEmail: clientEmail,
      title: 'Pago asistido actualizado',
      message: `Tu solicitud ${requestRef} ahora está ${currentStatus}.`,
      icon: currentStatus === 'pagado' ? 'check' : 'dollar',
      priority: currentStatus === 'rechazado' ? 'high' : 'medium',
      referenceId: requestData?.id,
    });

    await notifyAdmins(base44, {
      title: 'Estado de pago asistido actualizado',
      message: `La solicitud ${requestRef} cambió de ${previousStatus || 'sin estado'} a ${currentStatus}.`,
      icon: currentStatus === 'pagado' ? 'check' : 'dollar',
      priority: currentStatus === 'rechazado' ? 'high' : 'medium',
      referenceId: requestData?.id,
    });
  }

  return { ok: true, entity: 'AssistedPaymentRequest' };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const event = payload?.event || {};
    const entityName = event?.entity_name;
    const eventType = normalize(event?.type).toLowerCase();
    const entityId = event?.entity_id;

    let data = payload?.data || null;
    const oldData = payload?.old_data || null;

    if ((!data || payload?.payload_too_large) && entityName && entityId) {
      data = await base44.asServiceRole.entities[entityName].get(entityId);
    }

    if (!entityName || !eventType || !data || eventType === 'delete') {
      return Response.json({ ok: true, skipped: true });
    }

    if (entityName === 'User') {
      return Response.json(await handleUserNotification(base44, eventType, data, oldData));
    }

    if (entityName === 'Invoice') {
      return Response.json(await handleInvoiceNotification(base44, eventType, data, oldData));
    }

    if (entityName === 'AssistedPaymentRequest') {
      return Response.json(await handleAssistedPaymentNotification(base44, eventType, data, oldData));
    }

    return Response.json({ ok: true, skipped: true, entityName });
  } catch (error) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});