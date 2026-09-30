import { base44 } from '@/components/api/ApiQueueManager';
import { put, getAll } from '@/lib/offlineDb';

// Registro de los escaneos de despacho. Cada escaneo se guarda primero en el
// dispositivo (para que la guía de despacho no pierda ningún bulto si el
// almacén trabaja sin conexión) y después se envía al servidor. Si el envío
// falla, el escaneo queda pendiente y se reintenta al recuperar la conexión.
// La fecha real del escaneo (scanned_at) se registra desde el dispositivo, así
// que la guía conserva el día correcto aunque se suba después.

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
    await base44.entities.DispatchScanLog.create(toServerPayload(item));
    item.pending = false;
    await put('scan_logs', item).catch(() => {});
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
      await base44.entities.DispatchScanLog.create(toServerPayload(item));
      await put('scan_logs', { ...item, pending: false }).catch(() => {});
      sent += 1;
    } catch (e) {
      break; // sigue sin conexión: se reintenta en el próximo intento
    }
  }
  return sent;
}