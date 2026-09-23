// Lógica de sincronización: procesa el outbox de IndexedDB y envía cambios al servidor.
import { base44 } from '@/components/api/ApiQueueManager';
import * as db from '@/lib/offlineDb';

const MAX_ATTEMPTS = 5;

function isNetworkError(err) {
  const status = err?.status || err?.response?.status;
  if (status === 408 || status === 429 || status >= 500) return true;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  return /network|fetch|timeout|connection|failed/i.test(err?.message || '');
}

// Procesa un item del outbox. Lanza error si falla para reintentar.
export async function processSyncItem(item) {
  if (item.type === 'dispatch_package') {
    await syncDispatchPackage(item);
  } else if (item.type === 'manual_package') {
    await syncManualPackage(item);
  } else if (item.type === 'close_bulto') {
    await syncCloseBulto(item);
  } else if (item.type === 'remove_package') {
    await syncRemovePackage(item);
  }
}

// Sincroniza un paquete escaneado (encontrado en cache local) → marca despachado en servidor
async function syncDispatchPackage(item) {
  const payload = { tracking_number: item.tracking, action: 'dispatch' };
  if (item.photo_urls?.length) {
    payload.package_image_url = item.photo_urls[0];
    payload.package_image_urls = item.photo_urls;
  }
  const res = await base44.functions.invoke('scanDispatchPackage', payload);
  const data = res?.data || res;
  const serverPkg = data?.package;
  if (!serverPkg?.id) throw new Error('Respuesta inválida del servidor');

  // Actualizar paquete local con datos del servidor
  const localPkg = await db.getByIndex('packages', 'tracking_number', item.tracking.toUpperCase());
  if (localPkg) {
    await db.put('packages', { ...localPkg, ...serverPkg, _synced: true });
  }
}

// Sincroniza un paquete creado manualmente (no estaba en el sistema)
async function syncManualPackage(item) {
  const now = new Date().toISOString();
  const pkg = await base44.entities.Package.create({
    tracking_number: item.tracking,
    client_email: item.client_email,
    shipping_mark: item.client_snapshot?.shipping_mark || '',
    shipping_type: 'maritimo',
    status: 'despachado',
    description: 'Paquete manual',
    received_date: now,
    dispatched_date: now,
  });

  // Reemplazar paquete local con el del servidor
  if (item.local_package_id) {
    await db.del('packages', item.local_package_id);
  }
  await db.put('packages', { ...pkg, _synced: true });

  // Crear dispatch order fire-and-forget
  try {
    base44.functions.invoke('createDispatchOrder', {
      client_email: item.client_email,
      client_name: item.client_snapshot?.full_name || item.client_email,
      shipping_mark: item.client_snapshot?.shipping_mark || '',
      client_snapshot: {
        full_name: item.client_snapshot?.full_name || '',
        email: item.client_email,
        cedula: item.client_snapshot?.cedula || '',
        whatsapp: item.client_snapshot?.whatsapp || '',
        address: item.client_snapshot?.address || '',
        city: item.client_snapshot?.city || '',
        state: item.client_snapshot?.state || '',
        shipping_mark: item.client_snapshot?.shipping_mark || '',
      },
      items: [{ tracking_number: item.tracking, description: 'Paquete manual' }],
    }).catch(() => {});
  } catch (_) {}
}

// Sincroniza el cierre de un bulto
async function syncCloseBulto(item) {
  const bultoId = item.bulto_id;
  // Si es un bulto local (ID temporal), buscar el bulto del servidor por cliente
  if (!bultoId || String(bultoId).startsWith('local_')) {
    // El bulto del servidor ya fue creado/actualizado por syncDispatchPackage/syncManualPackage
    // Solo necesitamos cerrarlo: buscar por client_email + status=activo
    const serverBultos = await base44.entities.Bulto.filter(
      { client_email: item.bulto_snapshot?.client_email, status: 'activo' },
      '-created_date', 1
    );
    if (serverBultos?.[0]?.id) {
      await base44.functions.invoke('updateBulto', {
        bulto_id: serverBultos[0].id,
        status: 'despachado',
      });
    }
  } else {
    await base44.functions.invoke('updateBulto', {
      bulto_id: bultoId,
      status: 'despachado',
    });
  }
  // Eliminar bulto local
  if (bultoId) {
    await db.del('bultos', bultoId);
  }
}

// Sincroniza quitar el último paquete de un bulto
async function syncRemovePackage(item) {
  if (!item.bulto_id || String(item.bulto_id).startsWith('local_')) return;
  try {
    if (item.new_ids?.length === 0) {
      await base44.functions.invoke('deleteBulto', { bulto_id: item.bulto_id });
    } else {
      await base44.functions.invoke('updateBulto', {
        bulto_id: item.bulto_id,
        package_ids: item.new_ids,
      });
    }
  } catch (err) {
    // Si el bulto ya no existe en el servidor, ignorar
    if (err?.status === 404) return;
    throw err;
  }
}

// Ejecuta la sincronización completa del outbox. Devuelve el número de items procesados.
export async function runSync(onProgress) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 0;
  let processed = 0;
  while (true) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) break;
    const outbox = await db.getAll('sync_outbox');
    const pending = outbox
      .filter((i) => i.status === 'pending')
      .sort((a, b) => a.created_at - b.created_at);
    if (!pending.length) break;
    const item = pending[0];
    // Marcar como syncing
    await db.put('sync_outbox', { ...item, status: 'syncing' });
    onProgress?.();
    try {
      await processSyncItem(item);
      await db.del('sync_outbox', item.id);
      processed++;
      onProgress?.();
    } catch (err) {
      const att = (item.attempts || 0) + 1;
      if (isNetworkError(err) && att < MAX_ATTEMPTS) {
        // Reintentar después
        await db.put('sync_outbox', {
          ...item,
          status: 'pending',
          attempts: att,
          next_attempt_at: Date.now() + Math.min(30000, att * 5000),
        });
      } else {
        // Error permanente o máximo de intentos
        await db.put('sync_outbox', {
          ...item,
          status: 'error',
          attempts: att,
          error_message: err?.message || 'Error',
        });
      }
      onProgress?.();
      break; // Parar en error, reintentar después
    }
  }
  return processed;
}