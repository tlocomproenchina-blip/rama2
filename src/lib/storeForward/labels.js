import { kindOf } from './handlers';

// Textos sencillos para el operador sobre cada evento de la cola.

const KIND_LABELS = {
  bulto: 'Bulto',
  caja: 'Caja',
  package_reception: 'Recepción',
  scan_photo: 'Foto de escaneo',
  print_log: 'Impresión',
  caja_labels: 'Numeración de cajas',
  dispatch: 'Salida de paquete',
  bulto_dispatch: 'Salida de bulto',
  receive: 'Ubicación de paquete',
  pickpack: 'Movimiento / empaque',
  warehouse_mgmt: 'Almacén o ubicación',
  orphan_assign: 'Asignación de huérfano',
  admin_packages: 'Cambio de paquete',
  review: 'Revisión de paquete',
};

export const STATUS_LABELS = {
  pending: 'Guardado en este teléfono',
  syncing: 'Enviando',
  error: 'Reintentará solo',
  conflict: 'Requiere revisión',
  ok: 'Sincronizado',
  duplicate: 'Ya estaba registrado',
  discarded: 'Descartado',
  absorbed: 'Absorbido en una caja',
};

export const kindLabel = (kind) => KIND_LABELS[kind] || 'Operación';

export function describeEvent(item) {
  const kind = item.kind || kindOf(item);
  const ref = item.label_code || item.tracking || item.tracking_number || item.label
    || item.payload?.code || item.payload?.tracking_number || item.client_email || '';
  return { title: kindLabel(kind), ref };
}

export const timeLabel = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('es-VE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};