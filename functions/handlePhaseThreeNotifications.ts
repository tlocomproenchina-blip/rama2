import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

function normalize(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function dedupe(items = []) {
  return Array.from(new Set(items.filter(Boolean)));
}

function getDriverName(driver = {}) {
  const fullName = `${normalize(driver.nombres)} ${normalize(driver.apellidos)}`.trim();
  return fullName || driver.chofer_nombre || driver.full_name || driver.email || 'Chofer';
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

async function getEntityRecord(base44, entityName, id) {
  if (!id) return null;
  try {
    const rows = await base44.asServiceRole.entities[entityName].filter({ id }, '-updated_date', 1);
    return rows?.[0] || null;
  } catch (_) {
    return null;
  }
}

async function getEmailTemplate(base44, name) {
  const rows = await base44.asServiceRole.entities.EmailTemplate.filter({ name }, '-updated_date', 1);
  return rows?.[0] || null;
}

async function getAppConfig(base44) {
  const rows = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
  return rows?.[0] || {};
}

async function createNotification(base44, {
  userEmail,
  title,
  message,
  type = 'system',
  icon = 'bell',
  priority = 'medium',
  referenceId = '',
  entityType = 'System',
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
    entity_type: entityType,
    icon,
    read: false,
  });
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

async function sendEmail(base44, {
  to,
  templateName,
  fallbackSubject,
  fallbackBody,
  variables = {},
}) {
  if (!to) return;

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
  } catch (_) {
    await createEmailLog(base44, { to, subject, body, fromName, status: 'failed' });
  }
}

async function getInternalRecipients(base44) {
  const users = await base44.asServiceRole.entities.User.list('-updated_date', 300);
  return (users || []).filter((user) => {
    if (!user?.email) return false;
    if (user.role === 'admin') return true;
    const roleText = `${normalize(user.role)} ${normalize(user.custom_role)}`.toLowerCase();
    return roleText.includes('log') || roleText.includes('oper') || roleText.includes('seguimiento');
  });
}

async function notifyInternalUsers(base44, payload) {
  const users = await getInternalRecipients(base44);
  await Promise.all(users.map((user) => createNotification(base44, {
    userEmail: user.email,
    ...payload,
  })));
}

async function notifyClientsForRoute(base44, routeId, payload) {
  if (!routeId) return;
  const loads = await base44.asServiceRole.entities.CargaRuta.filter({ ruta_id: routeId }, '-updated_date', 200);
  const clientEmails = dedupe((loads || []).map((load) => load.cliente_email));

  await Promise.all(clientEmails.map(async (email) => {
    await createNotification(base44, {
      userEmail: email,
      ...payload,
      type: 'package',
      entityType: 'Package',
    });

    await sendEmail(base44, {
      to: email,
      fallbackSubject: payload.title,
      fallbackBody: payload.message,
    });
  }));
}

async function handleVehicleNotifications(base44, eventType, currentData, oldData) {
  const plate = currentData?.placa || oldData?.placa || 'vehículo';

  if (eventType === 'create') {
    await notifyInternalUsers(base44, {
      title: 'Nuevo vehículo registrado',
      message: `Se registró el vehículo ${plate}.`,
      icon: 'truck',
      priority: 'medium',
      referenceId: currentData?.id,
      entityType: 'System',
    });
  }

  if (eventType === 'update' && currentData?.estado && currentData?.estado !== oldData?.estado) {
    await notifyInternalUsers(base44, {
      title: 'Estado de vehículo actualizado',
      message: `El vehículo ${plate} cambió a estado ${currentData.estado}.`,
      icon: currentData.estado === 'mantenimiento' ? 'alert' : 'truck',
      priority: currentData.estado === 'mantenimiento' ? 'high' : 'medium',
      referenceId: currentData?.id,
      entityType: 'System',
    });
  }

  return { ok: true, entity: 'Vehiculo' };
}

async function handleDriverNotifications(base44, eventType, currentData, oldData) {
  const driverName = getDriverName(currentData || oldData || {});

  if (eventType === 'create') {
    await notifyInternalUsers(base44, {
      title: 'Nuevo chofer registrado',
      message: `Se registró el chofer ${driverName}.`,
      icon: 'bell',
      priority: 'medium',
      referenceId: currentData?.id,
      entityType: 'System',
    });
  }

  if (eventType === 'update' && currentData?.estado && currentData?.estado !== oldData?.estado) {
    await notifyInternalUsers(base44, {
      title: 'Estado de chofer actualizado',
      message: `El chofer ${driverName} cambió a estado ${currentData.estado}.`,
      icon: currentData.estado === 'suspendido' ? 'alert' : 'bell',
      priority: currentData.estado === 'suspendido' ? 'high' : 'medium',
      referenceId: currentData?.id,
      entityType: 'System',
    });
  }

  return { ok: true, entity: 'Chofer' };
}

async function handleRouteNotifications(base44, eventType, currentData, oldData) {
  const routeCode = currentData?.codigo_ruta || oldData?.codigo_ruta || 'ruta';
  const routeId = currentData?.id || oldData?.id;

  if (eventType === 'create') {
    await notifyInternalUsers(base44, {
      title: 'Nueva ruta registrada',
      message: `Se creó la ruta ${routeCode} desde ${currentData?.origen || '-'} hacia ${currentData?.destino || '-'}.`,
      icon: 'truck',
      priority: 'medium',
      referenceId: routeId,
      entityType: 'System',
    });
  }

  const assignmentChanged = eventType === 'update' && (
    currentData?.chofer_id !== oldData?.chofer_id ||
    currentData?.vehiculo_id !== oldData?.vehiculo_id
  );

  if (assignmentChanged) {
    const driver = currentData?.chofer_id ? await getEntityRecord(base44, 'Chofer', currentData.chofer_id) : null;
    const driverName = currentData?.chofer_nombre || getDriverName(driver || {});
    const driverEmail = driver?.email || driver?.user_email || '';
    const variables = {
      chofer_nombre: driverName,
      route_name: routeCode,
    };

    await notifyInternalUsers(base44, {
      title: 'Asignación de ruta actualizada',
      message: `La ruta ${routeCode} fue asignada a ${driverName || 'un chofer'} con vehículo ${currentData?.vehiculo_placa || '-'}.`,
      icon: 'truck',
      priority: 'high',
      referenceId: routeId,
      entityType: 'System',
    });

    await sendEmail(base44, {
      to: driverEmail,
      templateName: 'Base - Ruta Asignada',
      fallbackSubject: 'Nueva asignación de ruta: {route_name}',
      fallbackBody: 'Hola {chofer_nombre}, has sido asignado a la ruta {route_name}.',
      variables,
    });

    await createNotification(base44, {
      userEmail: driverEmail,
      title: 'Nueva ruta asignada',
      message: `Fuiste asignado a la ruta ${routeCode}.`,
      icon: 'truck',
      priority: 'high',
      referenceId: routeId,
      entityType: 'System',
    });
  }

  if (eventType === 'update' && currentData?.estado && currentData?.estado !== oldData?.estado) {
    const variables = {
      route_name: routeCode,
      status: currentData.estado,
    };

    await notifyInternalUsers(base44, {
      title: 'Estado de ruta actualizado',
      message: `La ruta ${routeCode} cambió a estado ${currentData.estado}.`,
      icon: currentData.estado === 'cancelada' ? 'alert' : 'truck',
      priority: currentData.estado === 'cancelada' ? 'high' : 'medium',
      referenceId: routeId,
      entityType: 'System',
    });

    await notifyClientsForRoute(base44, routeId, {
      title: 'Actualización de despacho',
      message: `Tu envío asociado a la ruta ${routeCode} cambió a estado ${currentData.estado}.`,
      icon: 'truck',
      priority: 'medium',
      referenceId: routeId,
    });

    const driver = currentData?.chofer_id ? await getEntityRecord(base44, 'Chofer', currentData.chofer_id) : null;
    const driverEmail = driver?.email || driver?.user_email || '';
    await sendEmail(base44, {
      to: driverEmail,
      templateName: 'Base - Estado Ruta Actualizado',
      fallbackSubject: 'Actualización de ruta: {route_name}',
      fallbackBody: 'La ruta {route_name} cambió a estado {status}.',
      variables,
    });
  }

  return { ok: true, entity: 'Ruta' };
}

async function handleTrackingNotifications(base44, eventType, currentData) {
  if (!currentData?.ruta_id) return { ok: true, entity: 'SeguimientoRuta', skipped: true };

  const route = await getEntityRecord(base44, 'Ruta', currentData.ruta_id);
  const routeCode = route?.codigo_ruta || 'ruta';
  const trackingTitleMap = {
    salida: 'Ruta despachada',
    en_transito: 'Ruta en tránsito',
    detenido: 'Ruta detenida',
    entrega_parcial: 'Entrega parcial en progreso',
    entregada: 'Entrega completada',
    incidencia: 'Incidencia en ruta',
  };

  const title = trackingTitleMap[currentData.estado] || 'Actualización de ruta';
  const detail = currentData.ubicacion
    ? `${title} en ${currentData.ubicacion}.`
    : `${title} para la ruta ${routeCode}.`;
  const message = `${detail}${currentData.comentario ? ` ${currentData.comentario}` : ''}`;

  await notifyInternalUsers(base44, {
    title,
    message,
    icon: currentData.estado === 'incidencia' ? 'alert' : 'truck',
    priority: currentData.estado === 'incidencia' ? 'high' : 'medium',
    referenceId: currentData.id || currentData.ruta_id,
    entityType: 'System',
  });

  const targetEmails = [];
  if (currentData.carga_ruta_id) {
    const load = await getEntityRecord(base44, 'CargaRuta', currentData.carga_ruta_id);
    if (load?.cliente_email) targetEmails.push(load.cliente_email);
  } else {
    const loads = await base44.asServiceRole.entities.CargaRuta.filter({ ruta_id: currentData.ruta_id }, '-updated_date', 200);
    (loads || []).forEach((load) => {
      if (load?.cliente_email) targetEmails.push(load.cliente_email);
    });
  }

  const uniqueEmails = dedupe(targetEmails);
  await Promise.all(uniqueEmails.map(async (email) => {
    await createNotification(base44, {
      userEmail: email,
      title,
      message,
      type: 'package',
      icon: currentData.estado === 'incidencia' ? 'alert' : 'truck',
      priority: currentData.estado === 'incidencia' ? 'high' : 'medium',
      referenceId: currentData.id || currentData.ruta_id,
      entityType: 'Package',
    });

    await sendEmail(base44, {
      to: email,
      fallbackSubject: title,
      fallbackBody: message,
    });
  }));

  return { ok: true, entity: 'SeguimientoRuta', eventType };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const event = payload?.event || {};
    const entityName = event?.entity_name;
    const eventType = normalize(event?.type).toLowerCase();
    const entityId = event?.entity_id;

    let currentData = payload?.data || null;
    const oldData = payload?.old_data || null;

    if ((!currentData || payload?.payload_too_large) && entityName && entityId) {
      currentData = await getEntityRecord(base44, entityName, entityId);
    }

    if (!entityName || !eventType || !currentData || eventType === 'delete') {
      return Response.json({ ok: true, skipped: true, entityName, eventType });
    }

    if (entityName === 'Vehiculo') {
      return Response.json(await handleVehicleNotifications(base44, eventType, currentData, oldData || {}));
    }

    if (entityName === 'Chofer') {
      return Response.json(await handleDriverNotifications(base44, eventType, currentData, oldData || {}));
    }

    if (entityName === 'Ruta') {
      return Response.json(await handleRouteNotifications(base44, eventType, currentData, oldData || {}));
    }

    if (entityName === 'SeguimientoRuta') {
      return Response.json(await handleTrackingNotifications(base44, eventType, currentData));
    }

    return Response.json({ ok: true, skipped: true, entityName });
  } catch (error) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});