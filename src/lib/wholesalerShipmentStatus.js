import moment from 'moment';

// Estados de un envío (aviso de carga) hacia la app del mayorista, para el
// historial y la consulta por paquete.
export const SHIPMENT_STATES = {
  enviado: { label: 'Enviado', tone: 'bg-emerald-100 text-emerald-700' },
  pendiente: { label: 'Pendiente', tone: 'bg-amber-100 text-amber-700' },
  fallido: { label: 'Envío fallido', tone: 'bg-rose-100 text-rose-700' },
  sin_aviso: { label: 'Sin aviso enviado', tone: 'bg-slate-100 text-slate-600' },
  no_registrado: { label: 'No registrado', tone: 'bg-slate-100 text-slate-600' },
};

export function shipmentState(estado) {
  return SHIPMENT_STATES[estado] || { label: estado || 'Sin estado', tone: 'bg-slate-100 text-slate-600' };
}

export function photosText(count) {
  const total = Number(count) || 0;
  return total === 1 ? '1 foto' : `${total} fotos`;
}

export function shipmentWhen(value) {
  if (!value) return '—';
  try {
    return moment(value).format('DD/MM/YYYY HH:mm');
  } catch (_) {
    return '—';
  }
}