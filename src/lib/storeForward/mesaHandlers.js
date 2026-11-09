import { base44 } from '@/components/api/ApiQueueManager';
import { getAll, put, del } from '@/lib/offlineDb';
import { toast } from 'sonner';
import { syncCajaLabels, syncPrintLog, syncScanPhoto } from '@/lib/packSyncTasks';
import { waitError } from './errors';

// Entregas de la Mesa de empaque. Cada unidad viaja con su id local: el servidor lo
// usa para reconocer un reintento y no registrarla dos veces.

const printQueueItem = (bulto) => ({
  id: bulto.id,
  label_code: bulto.label_code || '',
  client_email: bulto.client_email || '',
  client_name: bulto.client_snapshot?.full_name || '',
  bulto_number: bulto.bulto_number || 1,
  total_bultos: bulto.total_bultos || 1,
  package_count: bulto.package_ids?.length || bulto.package_trackings?.length || 0,
  bulto_snapshot: bulto,
  enqueued_at: new Date().toISOString(),
});

function reportDuplicates(list, ctx) {
  if (!list?.length) return;
  if (!ctx.emit('duplicates', list)) {
    toast.warning(`${list.length} tracking(s) ya estaban en otra unidad y se omitieron.`, { duration: 8000 });
  }
}

// Unidad cuyo contenido ya estaba registrado: no se registra y se sueltan sus impresiones.
async function dropLocalUnit(item, ctx) {
  const localBultos = await getAll('bultos').catch(() => []);
  for (const b of localBultos) {
    if ((b.local_bulto_id || b.id) === item.id) await del('bultos', b.id).catch(() => null);
  }
  const queue = await getAll('sync_queue').catch(() => []);
  for (const q of queue) {
    if (q.type === 'print_log' && q.bulto_local_id === item.id) await ctx.dropQueued(q, 'duplicate');
  }
  const message = `${item.label_code || 'La unidad'} ya estaba registrada: no se volvió a registrar.`;
  toast.info(message, { duration: 5000 });
  return { result: 'duplicate', message };
}

async function syncCaja(item, ctx) {
  const res = await base44.functions.invoke('syncCaja', {
    local_unit_id: item.id,
    label_code: item.label_code,
    client_email: item.client_email,
    package_codes: item.package_codes || [],
    absorb_codes: item.absorb_codes || [],
    combine_codes: item.combine_codes || [],
    unregistered_codes: item.unregistered_codes || [],
    cbm_order_numbers: item.cbm_order_numbers || [],
    device_id: item.device_id || '',
    recognition_photo_url: item.recognition_photo_url || '',
    closed_at: item.closed_at || '',
    merge_into: item.merge_into || '',
  });
  const data = res?.data || res || {};
  reportDuplicates(data.duplicates, ctx);
  if (data.duplicate_only) return dropLocalUnit(item, ctx);
  if (!data.caja) throw new Error(data.error || 'No se pudo registrar la caja');

  const localBultos = await getAll('bultos').catch(() => []);
  const finalLabel = data.caja.label_code;
  const localCaja = localBultos.find((b) => (b.local_bulto_id || b.id) === item.id || b.label_code === item.label_code)
    || localBultos.find((b) => b.label_code === finalLabel);
  if (localCaja) {
    await put('bultos', { ...localCaja, ...data.caja, id: localCaja.id, is_local: false, synced: true, merge_pending: false, server_bulto_id: data.caja.id }).catch(() => {});
    // Una sola copia por caja en el dispositivo.
    for (const b of localBultos) {
      if (b.id !== localCaja.id && b.is_caja && b.label_code === finalLabel) await del('bultos', b.id).catch(() => null);
    }
  }
  for (const code of [...(item.absorb_codes || []), ...(item.combine_codes || [])]) {
    const absorbed = localBultos.find((b) => b.label_code === code && (b.local_bulto_id || b.id) !== item.id);
    if (absorbed?.id) await del('bultos', absorbed.id).catch(() => null);
  }
  if (data.relabeled?.merged) {
    if (data.relabeled.to !== item.merge_into) {
      toast.info(`El contenido de ${data.relabeled.from} se sumó a la caja ${data.relabeled.to} del cliente (una sola caja). Reimprime su etiqueta.`, { duration: 12000 });
    }
  } else if (data.relabeled) {
    toast.warning(`El código ${data.relabeled.from} ya lo tenía otra unidad: esta caja quedó como ${data.relabeled.to}.`, { duration: 12000 });
  }
  return { result: 'ok' };
}

async function syncBulto(item, ctx) {
  const res = await base44.functions.invoke('syncBultoBatch', {
    local_bulto_id: item.id,
    label_code: item.label_code,
    client_email: item.client_email,
    shipping_mark: item.shipping_mark,
    bulto_number: item.bulto_number,
    total_bultos: item.total_bultos,
    package_ids: item.package_ids || [],
    package_trackings: item.package_trackings || [],
    client_snapshot: item.client_snapshot || {},
    invoice_paid: item.invoice_paid || false,
    invoice_status: item.invoice_status || '',
    invoice_number: item.invoice_number || '',
    cbm_order_numbers: item.cbm_order_numbers || [],
    combine_codes: item.combine_codes || [],
    warehouse_id: item.warehouse_id || '',
    created_by: item.created_by || '',
    closed_at: item.closed_at || new Date(item.created_at || Date.now()).toISOString(),
  });
  const data = res?.data || {};
  reportDuplicates(data.duplicates, ctx);
  if (data.duplicate) return dropLocalUnit(item, ctx);
  if (!data.success && !data.already_exists) throw new Error(data.error || 'Error desconocido');

  const serverBulto = data.bulto;
  if (!serverBulto?.id) return { result: data.already_exists ? 'duplicate' : 'ok' };
  const localBultos = await getAll('bultos').catch(() => []);
  const localBulto = localBultos.find((b) => (b.local_bulto_id || b.id) === item.id);
  if (!localBulto) return { result: 'ok' };
  const updated = {
    ...localBulto,
    label_code: serverBulto.label_code || localBulto.label_code,
    bulto_number: serverBulto.bulto_number || localBulto.bulto_number,
    server_bulto_id: serverBulto.id,
    synced: true,
  };
  await put('bultos', updated).catch(() => {});
  // La etiqueta ya se imprimió al cerrar: solo se reimprime si el código cambió. Se deja
  // en la cola de impresión del teléfono aunque la Mesa no esté abierta.
  if (data.relabeled) {
    await put('print_queue', printQueueItem(updated)).catch(() => {});
    ctx.emit('relabeled', updated);
    toast.warning(`El código ${data.relabeled.from} ya lo tenía otra unidad: este bulto quedó como ${data.relabeled.to}. Su etiqueta quedó en la cola de impresión.`, { duration: 12000 });
  }
  return { result: 'ok' };
}

async function syncReception(item) {
  await base44.entities.Package.update(item.package_id, {
    status: item.status,
    received_date: item.received_date,
    received_by: item.received_by,
  });
  return { result: 'ok' };
}

async function syncLabels(item) {
  try {
    await syncCajaLabels(item);
  } catch (e) {
    if (/Esperando/.test(e?.message || '')) throw waitError(e.message);
    throw e;
  }
  return { result: 'ok' };
}

export const MESA_HANDLERS = {
  bulto: syncBulto,
  caja: syncCaja,
  package_reception: syncReception,
  scan_photo: async (item, ctx) => { await syncScanPhoto(item, ctx.save); return { result: 'ok' }; },
  print_log: async (item) => { await syncPrintLog(item); return { result: 'ok' }; },
  caja_labels: syncLabels,
};