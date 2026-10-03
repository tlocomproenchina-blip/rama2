// Núcleo compartido de la integración con la app del cliente mayorista:
// configuración de la conexión, historial de movimientos y fechas en hora de Caracas.

const CONFIG_KEY = 'main';
export const WHOLESALER_SOURCE = 'mayorista';

export async function getWholesalerConfig(base44: any) {
  try {
    const rows = await base44.asServiceRole.entities.WholesalerSync.filter({ config_key: CONFIG_KEY }, '-updated_date', 1);
    if (rows?.[0]) return rows[0];
  } catch (_) {}

  // Primera vez: dejar la configuración creada con los valores por defecto.
  try {
    return await base44.asServiceRole.entities.WholesalerSync.create({
      config_key: CONFIG_KEY,
      wholesaler_name: 'Cliente mayorista',
      intake_enabled: true,
      report_email_enabled: true,
      notify_enabled: true,
      last_run_status: 'nunca',
      last_report_status: 'nunca',
    });
  } catch (_) {
    return { config_key: CONFIG_KEY };
  }
}

export async function updateWholesalerConfig(base44: any, patch: Record<string, any>) {
  try {
    const cfg = await getWholesalerConfig(base44);
    if (!cfg?.id) return;
    await base44.asServiceRole.entities.WholesalerSync.update(cfg.id, patch);
  } catch (_) {}
}

export async function logWholesalerEvent(base44: any, entry: Record<string, any>) {
  try {
    return await base44.asServiceRole.entities.WholesalerLog.create({
      event_date: new Date().toISOString(),
      source_app: WHOLESALER_SOURCE,
      ...entry,
    });
  } catch (_) {
    return null;
  }
}

export function caracasDateKey(date: Date = new Date()) {
  // en-CA devuelve YYYY-MM-DD
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
}

export function formatCaracasDateTime(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-VE', {
      timeZone: 'America/Caracas',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (_) {
    return '—';
  }
}

export async function emailsEnabled(base44: any) {
  try {
    const cfgs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
    return cfgs?.[0]?.emails_enabled !== false;
  } catch (_) {
    return true;
  }
}

export function truncate(value: any, max = 900) {
  return String(value ?? '').slice(0, max);
}