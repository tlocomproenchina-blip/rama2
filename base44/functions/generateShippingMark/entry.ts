import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { sendBrevoEmail } from '../../shared/brevoEmail.ts';

const START_NUMBER = 50000;
const COUNTER_KEY = 'main';
const MAX_ATTEMPTS = 12;

const replaceTemplateVariables = (text, variables = {}) => {
  let result = String(text || '');
  Object.entries(variables).forEach(([key, value]) => {
    result = result.split(`{${key}}`).join(String(value ?? ''));
    result = result.split(`{{${key}}}`).join(String(value ?? ''));
  });
  return result;
};

const getPersonName = (person = {}) => {
  if (person.first_name && person.last_name) return `${person.first_name} ${person.last_name}`;
  return person.full_name || person.email || 'Usuario';
};

const notifyShippingMarkAssigned = async (base44, targetUser, shippingMark) => {
  if (!targetUser?.email || !shippingMark) return;

  const appConfigs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
  const appConfig = appConfigs?.[0] || {};
  const templateRows = await base44.asServiceRole.entities.EmailTemplate.filter({ name: 'Base - Shipping Mark Asignado' }, '-updated_date', 1);
  const template = templateRows?.[0] || null;
  const fromName = appConfig.invoice_company_name || appConfig.app_name || 'TLEC CARGO';
  const variables = {
    cliente_nombre: getPersonName(targetUser),
    shipping_mark: shippingMark,
  };
  const subject = replaceTemplateVariables(template?.subject || 'Tu Shipping Mark ha sido asignado', variables);
  const body = replaceTemplateVariables(template?.body || 'Hola {cliente_nombre}, tu Shipping Mark es {shipping_mark}.', variables);

  try {
    const result = await sendBrevoEmail(base44, {
      to: targetUser.email,
      subject,
      body,
      from_name: fromName,
    });

    await base44.asServiceRole.entities.EmailLog.create({
      recipient_email: targetUser.email,
      recipient_name: null,
      sender_email: null,
      from_name: fromName,
      subject,
      body_preview: body.slice(0, 200),
      source: 'manual',
      status: result.sent ? 'sent' : 'failed',
      sent_date: new Date().toISOString(),
    });
  } catch (error) {
    await base44.asServiceRole.entities.EmailLog.create({
      recipient_email: targetUser.email,
      recipient_name: null,
      sender_email: null,
      from_name: fromName,
      subject,
      body_preview: body.slice(0, 200),
      source: 'manual',
      status: 'failed',
      sent_date: new Date().toISOString(),
    });
  }

  await base44.asServiceRole.entities.Notification.create({
    user_email: targetUser.email,
    title: 'Shipping Mark asignado',
    message: `Tu código asignado es ${shippingMark}.`,
    type: 'system',
    priority: 'high',
    reference_id: targetUser.id,
    entity_type: 'System',
    icon: 'check',
    read: false,
  });
};

// Resuelve el state_code_external (N1–N7) a partir del estado del usuario.
// El usuario guarda state_code (ej: 'tachira'); por compatibilidad también
// buscamos por state_name por si un perfil antiguo guardó el nombre.
const resolveStateCodeExternal = async (base44, userState) => {
  if (!userState) return null;
  const value = String(userState).trim().toLowerCase();
  // Buscar por state_code
  let rows = await base44.asServiceRole.entities.StateConfig.filter({ state_code: value }, '-updated_date', 1);
  if (!rows?.length) {
    // Fallback: buscar por state_name (case-insensitive en memoria)
    const all = await base44.asServiceRole.entities.StateConfig.filter({ is_active: true }, '-updated_date', 100);
    rows = (all || []).filter((s) => String(s.state_name || '').trim().toLowerCase() === value);
  }
  const match = rows?.[0];
  if (!match) return null;
  const code = String(match.state_code_external || '').trim().toUpperCase();
  return code || null;
};

// Contador global atómico con optimistic locking.
// Lee el valor actual, intenta updateMany con filtro last_number=valorViejo.
// Si modificó 1 → ganó; si 0 → otro proceso ganó, releer y reintentar.
const reserveNextNumber = async (base44) => {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const counters = await base44.asServiceRole.entities.ShippingMarkCounter.filter({ config_key: COUNTER_KEY }, '-updated_date', 1);
    let counter = counters?.[0] || null;

    // Inicializar el contador si no existe
    if (!counter) {
      try {
        counter = await base44.asServiceRole.entities.ShippingMarkCounter.create({
          config_key: COUNTER_KEY,
          last_number: START_NUMBER - 1,
        });
      } catch (createErr) {
        // Otro proceso lo creó al mismo tiempo: releer en el siguiente intento
        await new Promise((r) => setTimeout(r, 50));
        continue;
      }
    }

    const oldValue = Number(counter.last_number) || (START_NUMBER - 1);
    const nextValue = oldValue + 1;

    const result = await base44.asServiceRole.entities.ShippingMarkCounter.updateMany(
      { config_key: COUNTER_KEY, last_number: oldValue },
      { $inc: { last_number: 1 } }
    );

    if (result?.modifiedCount === 1 || result?.matchedCount === 1) {
      return nextValue;
    }
    // Conflict: otro registro simultáneo ganó. Reintentar tras breve pausa.
    await new Promise((r) => setTimeout(r, 60));
  }
  return null;
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    let payload = {};
    try {
      payload = await req.json();
    } catch (_) {
      payload = {};
    }

    const isAutomation = payload?.event?.entity_name === 'User';

    let authedUser = null;
    try {
      authedUser = await base44.auth.me();
    } catch (_) {
      authedUser = null;
    }

    if (!isAutomation && !authedUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const appConfigs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
    const appConfig = appConfigs?.[0] || null;

    if (!appConfig?.shipping_mark_auto_assign_enabled) {
      return Response.json({ success: true, skipped: true, reason: 'disabled' });
    }

    let targetUser = null;
    let previousUser = payload?.old_data || null;

    if (isAutomation) {
      targetUser = payload?.data || null;
      if ((!targetUser || payload?.payload_too_large) && payload?.event?.entity_id) {
        const rows = await base44.asServiceRole.entities.User.filter({ id: payload.event.entity_id }, '-updated_date', 1);
        targetUser = rows?.[0] || null;
      }
    } else if (payload?.user_id && authedUser?.role === 'admin') {
      const rows = await base44.asServiceRole.entities.User.filter({ id: payload.user_id }, '-updated_date', 1);
      targetUser = rows?.[0] || null;
    } else {
      targetUser = authedUser;
    }

    if (!targetUser) {
      return Response.json({ success: true, skipped: true, reason: 'user_not_found' });
    }

    if (targetUser.role !== 'user') {
      return Response.json({ success: true, skipped: true, reason: 'not_client' });
    }

    if (!targetUser.profile_completed) {
      return Response.json({ success: true, skipped: true, reason: 'profile_incomplete' });
    }

    if (targetUser.shipping_mark) {
      return Response.json({ success: true, shipping_mark: targetUser.shipping_mark, assigned: false, skipped: true, reason: 'already_exists' });
    }

    if (isAutomation && payload?.event?.type === 'update' && previousUser?.shipping_mark) {
      return Response.json({ success: true, skipped: true, reason: 'already_had_mark' });
    }

    // Resolver código de estado (N1–N7) desde el estado del usuario
    const stateCodeExternal = await resolveStateCodeExternal(base44, targetUser.state);
    if (!stateCodeExternal) {
      return Response.json({
        success: false,
        skipped: true,
        reason: 'state_code_external_missing',
        message: `No se encontró state_code_external para el estado "${targetUser.state}". Verifica StateConfig.`,
      }, { status: 400 });
    }

    // Reservar número secuencial global con optimistic locking (evita duplicados en registros simultáneos)
    const nextNumber = await reserveNextNumber(base44);
    if (!nextNumber) {
      return Response.json({ error: 'No se pudo reservar un número de Shipping Mark tras varios intentos (concurrencia).' }, { status: 500 });
    }

    const shippingMark = `${stateCodeExternal}-TLEC-${nextNumber}`;

    await base44.asServiceRole.entities.User.update(targetUser.id, { shipping_mark: shippingMark });

    // Actualizar paquetes existentes del cliente que no tengan shipping mark
    if (targetUser.email) {
      const packages = await base44.asServiceRole.entities.Package.filter({ client_email: targetUser.email }, '-updated_date', 200);
      const packagesToUpdate = (packages || []).filter((pkg) => !pkg.shipping_mark);
      for (const pkg of packagesToUpdate) {
        await base44.asServiceRole.entities.Package.update(pkg.id, { shipping_mark: shippingMark });
      }
    }

    await notifyShippingMarkAssigned(base44, targetUser, shippingMark);

    return Response.json({ success: true, shipping_mark: shippingMark, assigned: true, sequence_number: nextNumber, state_code_external: stateCodeExternal });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}