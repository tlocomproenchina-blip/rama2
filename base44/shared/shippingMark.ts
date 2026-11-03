// Asignación del Shipping Mark de un cliente: contador global atómico + código de
// estado (N1–N7). Vive aquí porque lo usan la función generateShippingMark y el
// alta de clientes que llegan desde la app del mayorista.
import { sendBrevoEmail } from './brevoEmail.ts';

const START_NUMBER = 5000;
const COUNTER_KEY = 'main';
const MAX_ATTEMPTS = 12;

const replaceTemplateVariables = (text: any, variables: Record<string, any> = {}) => {
  let result = String(text || '');
  Object.entries(variables).forEach(([key, value]) => {
    result = result.split(`{${key}}`).join(String(value ?? ''));
    result = result.split(`{{${key}}}`).join(String(value ?? ''));
  });
  return result;
};

const getPersonName = (person: any = {}) => {
  if (person.first_name && person.last_name) return `${person.first_name} ${person.last_name}`;
  return person.full_name || person.email || 'Usuario';
};

export async function shippingMarkAutoAssignEnabled(base44: any) {
  try {
    const cfgs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
    return !!cfgs?.[0]?.shipping_mark_auto_assign_enabled;
  } catch (_) {
    return false;
  }
}

// Resuelve el state_code_external (N1–N7) a partir del estado del usuario.
export async function resolveStateCodeExternal(base44: any, userState: string | null | undefined) {
  if (!userState) return null;
  const value = String(userState).trim().toLowerCase();
  let rows = await base44.asServiceRole.entities.StateConfig.filter({ state_code: value }, '-updated_date', 1);
  if (!rows?.length) {
    const all = await base44.asServiceRole.entities.StateConfig.filter({ is_active: true }, '-updated_date', 100);
    rows = (all || []).filter((s: any) => String(s.state_name || '').trim().toLowerCase() === value);
  }
  const match = rows?.[0];
  if (!match) return null;
  const code = String(match.state_code_external || '').trim().toUpperCase();
  return code || null;
}

// Contador global atómico con optimistic locking.
export async function reserveShippingMarkNumber(base44: any) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const counters = await base44.asServiceRole.entities.ShippingMarkCounter.filter({ config_key: COUNTER_KEY }, '-updated_date', 1);
    let counter = counters?.[0] || null;

    if (!counter) {
      try {
        counter = await base44.asServiceRole.entities.ShippingMarkCounter.create({
          config_key: COUNTER_KEY,
          last_number: START_NUMBER - 1,
        });
      } catch (_) {
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

    if (result?.updated >= 1) return nextValue;
    await new Promise((r) => setTimeout(r, 60));
  }
  return null;
}

// Asigna Shipping Mark al cliente (y a sus paquetes sin mark).
export async function assignShippingMarkToUser(base44: any, targetUser: any) {
  const stateCodeExternal = await resolveStateCodeExternal(base44, targetUser?.state);
  if (!stateCodeExternal) {
    return {
      ok: false,
      reason: 'state_code_external_missing',
      error: `No se encontró state_code_external para el estado "${targetUser?.state || '(vacío)'}". Verifica StateConfig.`,
    };
  }

  const nextNumber = await reserveShippingMarkNumber(base44);
  if (!nextNumber) {
    return { ok: false, reason: 'counter_conflict', error: 'No se pudo reservar un número de Shipping Mark tras varios intentos (concurrencia).' };
  }

  const shippingMark = `${stateCodeExternal}-TLEC-${nextNumber}`;

  try {
    await base44.asServiceRole.entities.User.update(targetUser.id, { shipping_mark: shippingMark });
  } catch (err: any) {
    return { ok: false, reason: 'user_update_failed', error: err?.message || 'No se pudo guardar el Shipping Mark.' };
  }

  // Paquetes existentes del cliente que no tengan shipping mark
  if (targetUser.email) {
    try {
      const packages = await base44.asServiceRole.entities.Package.filter({ client_email: targetUser.email }, '-updated_date', 200);
      const pending = (packages || []).filter((pkg: any) => !pkg.shipping_mark);
      for (const pkg of pending) {
        await base44.asServiceRole.entities.Package.update(pkg.id, { shipping_mark: shippingMark });
      }
    } catch (_) {}
  }

  return { ok: true, shipping_mark: shippingMark, sequence_number: nextNumber, state_code_external: stateCodeExternal };
}

export async function notifyShippingMarkAssigned(base44: any, targetUser: any, shippingMark: string) {
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
  } catch (_) {
    try {
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
    } catch (_) {}
  }

  try {
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
  } catch (_) {}
}