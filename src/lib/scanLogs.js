import { base44 } from '@/components/api/ApiQueueManager';
import { put, getAll } from '@/lib/offlineDb';

// Registro de los escaneos de despacho. Cada escaneo se guarda primero en el
// dispositivo (para que la guía de despacho no pierda ningún bulto si el
// almacén trabaja sin conexión) y después se envía al servidor. Si el envío
// falla, el escaneo queda pendiente y se reintenta al recuperar la conexión.
// La fecha real del escaneo (scanned_at) se registra desde el dispositivo, así
// que la guía conserva el día correcto aunque se suba después.
// Al registrar un bulto despachado se arma o se completa sola la guía de
// despacho de su cliente (attachScanToDispatchGuide).

const newLocalId = () => `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const toServerPayload = (item) => ({
  scanned_code: item.scanned_code || '',
  scan_type: item.scan_type || 'package',
  result: item.result || 'found',
  client_email: item.client_email || '',
  client_name: item.client_name || '',
  shipping_mark: item.shipping_mark || '',
  tracking_number: item.tracking_number || '',
  package_id: item.package_id || '',
  bulto_label_code: item.bulto_label_code || '',
  package_count: item.package_count || 0,
  scanned_at: item.scanned_at || new Date().toISOString(),
  scanned_by: item.scanned_by || '',
  offline: item.offline ?? false,
});

// Bulto despachado: la guía del cliente se crea si no existe o se completa con
// este bulto. Si falla (por ejemplo sin conexión) el escaneo queda registrado
// igual y la guía se arma al reenviarlo o desde la emisión manual.
async function attachBultoToGuide(item, user) {
  if (item.scan_type !== 'bulto') return null;
  if (item.result !== 'dispatched' && item.result !== 'already_dispatched') return null;
  try {
    const res = await base44.functions.invoke('attachScanToDispatchGuide', {
      label_code: item.bulto_label_code || item.scanned_code || '',
      client_email: item.client_email || '',
      client_name: item.client_name || '',
      shipping_mark: item.shipping_mark || '',
      package_count: item.package_count || 0,
      scanned_at: item.scanned_at,
      scanned_by: item.scanned_by || user?.email || '',
    });
    const data = res?.data || res || {};
    if (!data?.guide_number) return null;
    return { guide_number: data.guide_number, guide_created: !!data.created };
  } catch (e) {
    console.warn('La guía del bulto se armará al reintentar el envío:', e?.message || e);
    return null;
  }
}

export async function recordScanLog(entry, user) {
  const scannedAt = entry.scanned_at || new Date().toISOString();
  const item = {
    id: entry.local_id || newLocalId(),
    scanned_at: scannedAt,
    created_date: scannedAt,
    scanned_code: entry.scanned_code || '',
    scan_type: entry.scan_type || 'package',
    result: entry.result || 'found',
    client_email: entry.client_email || '',
    client_name: entry.client_name || '',
    shipping_mark: entry.shipping_mark || '',
    tracking_number: entry.tracking_number || '',
    package_id: entry.package_id || '',
    bulto_label_code: entry.bulto_label_code || '',
    package_count: entry.package_count || 0,
    scanned_by: entry.scanned_by || user?.email || '',
    offline: entry.offline ?? false,
    pending: true,
  };

  await put('scan_logs', item).catch(() => {});

  try {
    const created = await base44.entities.DispatchScanLog.create(toServerPayload(item));
    item.pending = false;
    item.server_id = created?.id || '';
    await put('scan_logs', item).catch(() => {});

    const guide = await attachBultoToGuide(item, user);
    if (guide) {
      Object.assign(item, guide);
      await put('scan_logs', item).catch(() => {});
    }
  } catch (e) {
    // Sin conexión: queda guardado en el dispositivo y se reenvía al reconectar.
    console.warn('Escaneo guardado en el dispositivo; se enviará al reconectar:', e?.message || e);
  }

  return item;
}

export async function getLocalScanLogs() {
  return getAll('scan_logs').catch(() => []);
}

// Reenvía los escaneos que quedaron pendientes (sin conexión) al servidor.
export async function flushPendingScanLogs() {
  const all = await getLocalScanLogs();
  const pending = all.filter((l) => l.pending);
  if (!pending.length) return 0;
  let sent = 0;
  for (const item of pending) {
    try {
      const created = await base44.entities.DispatchScanLog.create(toServerPayload(item));
      const saved = { ...item, pending: false, server_id: created?.id || '' };
      await put('scan_logs', saved).catch(() => {});
      sent += 1;

      const guide = await attachBultoToGuide(saved);
      if (guide) await put('scan_logs', { ...saved, ...guide }).catch(() => {});
    } catch (e) {
      break; // sigue sin conexión: se reintenta en el próximo intento
    }
  }
  return sent;
}