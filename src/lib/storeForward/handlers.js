import { base44 } from '@/components/api/ApiQueueManager';
import { toast } from 'sonner';
import { MESA_HANDLERS } from './mesaHandlers';
import { conflictError, statusOf } from './errors';

// Qué hace el servidor con cada tipo de evento de la bodega. Cada handler devuelve
// { result: 'ok' | 'duplicate' } o lanza un error (ver errors.js).

export const kindOf = (item) => item?.queue_type || item?.type || 'bulto';

// Datos que acompañan cada envío para que el servidor reconozca un reintento.
const withEvent = (item) => ({
  ...(item.payload || {}),
  client_event_id: item.id,
  device_created_at: item.device_created_at || '',
});

async function invoke(name, payload) {
  const res = await base44.functions.invoke(name, payload);
  return res?.data || res || {};
}

async function dispatchHandler(item) {
  const data = item.type === 'bulto_dispatch'
    ? await invoke('dispatchBulto', {
      label_code: item.label_code,
      ...(item.photo_urls?.length ? { photo_url: item.photo_urls[0] } : {}),
    })
    : await invoke('scanDispatchPackage', {
      tracking_number: item.tracking,
      action: 'dispatch',
      ...(item.photo_urls?.length ? { package_image_url: item.photo_urls[0], package_image_urls: item.photo_urls } : {}),
    });
  if (data.already_dispatched) {
    toast.info(`Ya fue despachado en otro dispositivo: ${item.tracking || item.label_code || ''}`, { duration: 4000 });
    return { result: 'duplicate' };
  }
  if (data.package?.id || data.success || data.bulto) return { result: 'ok' };
  throw new Error(data.error || 'Error desconocido');
}

async function receiveHandler(item) {
  const data = await invoke('assignPackageToLocation', withEvent(item));
  if (data.already_received) {
    toast.info('Paquete ya fue recibido en otro dispositivo', { duration: 4000 });
    return { result: 'duplicate' };
  }
  if (data.location_full) throw conflictError(`Ubicación llena: ${data.location?.code || ''}. Reasigna el paquete.`);
  if (data.error) throw new Error(data.error);
  return { result: 'ok' };
}

async function pickpackHandler(item) {
  const fn = item.operation === 'packing' ? 'confirmPacking' : 'updatePackageLocationStatus';
  const data = await invoke(fn, withEvent(item));
  if (data.error) throw new Error(data.error);
  return { result: data.replayed ? 'duplicate' : 'ok' };
}

const MGMT_FUNCTIONS = {
  create_location: 'createWarehouseLocation',
  update_location: 'updateWarehouseLocation',
  delete_location: 'deleteWarehouseLocation',
  create_warehouse: 'createWarehouse',
  update_warehouse: 'updateWarehouse',
  delete_warehouse: 'deleteWarehouse',
};

async function mgmtHandler(item) {
  const fn = MGMT_FUNCTIONS[item.operation];
  if (!fn) throw conflictError('Operación desconocida');
  const data = await invoke(fn, withEvent(item));
  if (data.error) throw new Error(data.error);
  return { result: data.replayed ? 'duplicate' : 'ok' };
}

async function orphanHandler(item) {
  const data = await invoke('assignOrphanPackage', withEvent(item));
  if (data.error) throw new Error(data.error);
  return { result: data.replayed ? 'duplicate' : 'ok' };
}

async function adminPackagesHandler(item) {
  if (item.operation === 'update') {
    await base44.entities.Package.update(item.payload.id, item.payload.patch);
    return { result: 'ok' };
  }
  if (item.operation === 'delete') {
    try {
      await base44.entities.Package.delete(item.payload.id);
    } catch (e) {
      if (statusOf(e) === 404) return { result: 'duplicate' };
      throw e;
    }
    return { result: 'ok' };
  }
  throw conflictError('Operación desconocida');
}

export const HANDLERS = {
  ...MESA_HANDLERS,
  dispatch: dispatchHandler,
  bulto_dispatch: dispatchHandler,
  receive: receiveHandler,
  pickpack: pickpackHandler,
  warehouse_mgmt: mgmtHandler,
  orphan_assign: orphanHandler,
  admin_packages: adminPackagesHandler,
};