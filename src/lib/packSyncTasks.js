import { base44 } from '@/components/api/ApiQueueManager';
import { get, put } from '@/lib/offlineDb';

// Tareas de la cola offline de la Mesa de empaque que no son unidades: fotos de escaneo,
// impresiones y numeración de etiquetas de caja. Todo se captura en el dispositivo al
// instante (con su hora real) y aquí se entrega al servidor cuando hay conexión.

const isLocalId = (id) => String(id || '').startsWith('local_');

// Foto del escaneo guardada en el dispositivo: se sube una sola vez (la URL queda en la
// tarea para que un reintento no la vuelva a subir) y se agrega a las fotos del paquete.
export async function syncScanPhoto(item, saveItem) {
  let photoUrl = item.photo_url || '';
  if (!photoUrl) {
    const res = await base44.functions.invoke('uploadImageToBunny', { image_base64: item.image_base64 });
    photoUrl = res?.data?.url || '';
    if (!photoUrl) throw new Error('No se pudo subir la foto');
    await saveItem({ ...item, photo_url: photoUrl });
  }

  const local = await get('packages', item.package_id).catch(() => null);
  const server = isLocalId(item.package_id)
    ? null
    : await base44.entities.Package.get(item.package_id).catch(() => null);
  const base = server || local || {};
  const urls = [...new Set([...(base.package_image_urls || []), photoUrl])].slice(0, 3);
  const fields = { package_image_url: base.package_image_url || photoUrl, package_image_urls: urls };

  if (local) await put('packages', { ...local, ...fields }).catch(() => {});
  // Paquete creado a mano en el dispositivo: todavía no existe en el servidor.
  if (!isLocalId(item.package_id) && server) {
    await base44.entities.Package.update(item.package_id, fields);
  }
}

// Impresión hecha en el dispositivo: el servidor la ubica por el id local o el código.
export async function syncPrintLog(item) {
  const res = await base44.functions.invoke('registerBultoPrint', {
    bulto_id: item.bulto_local_id,
    label_code: item.label_code,
    printed_at: item.printed_at,
  });
  if (res?.data?.error) throw new Error(res.data.error);
}

// Numeración X/N que quedó impresa en la tira de etiquetas continuas.
export async function syncCajaLabels(item) {
  const res = await base44.functions.invoke('assignCajaLabels', {
    client_email: item.client_email,
    assignments: item.assignments || [],
  });
  const missing = res?.data?.missing || [];
  if (missing.length) throw new Error(`Esperando que se registre ${missing[0]}`);
}

export function describeQueueItem(item) {
  if (item.type === 'scan_photo') return `Foto · ${item.tracking_number || ''}`;
  if (item.type === 'print_log') return `Impresión · ${item.label_code || ''}`;
  if (item.type === 'caja_labels') return `Numeración de cajas · ${item.client_email || ''}`;
  if (item.type === 'package_reception') return `Recepción · ${item.tracking_number || ''}`;
  return item.label_code || 'Unidad';
}