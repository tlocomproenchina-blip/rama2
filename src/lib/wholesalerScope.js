// Filtro para limitar consultas a un solo mayorista. Los registros sin marca
// son de la conexión principal ('main').
export function scopeFor(key) {
  if (!key || key === 'todos') return {};
  if (key !== 'main') return { wholesaler_key: key };
  return { $or: [{ wholesaler_key: 'main' }, { wholesaler_key: '' }, { wholesaler_key: null }, { wholesaler_key: { $exists: false } }] };
}

export const toRows = (r) => (Array.isArray(r) ? r : r?.items || []);

export function regexFor(term) {
  const clean = String(term || '').trim();
  return clean ? { $regex: clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } : null;
}

export const money = (v) => `$${(Number(v) || 0).toFixed(2)}`;

export function cbmFmt(v) {
  return (Math.round((Number(v) || 0) * 10000) / 10000).toString();
}

export const EVENT_LABELS = {
  recepcion: 'Recibido en almacén',
  recepcion_existente: 'Recibido (ya registrado)',
  aviso_enviado: 'Aviso enviado al mayorista',
  aviso_fallido: 'Aviso fallido',
  prealerta_reportada: 'Pre-alerta (en tránsito)',
  prealerta_duplicada: 'Pre-alerta duplicada',
  prealerta_rechazada: 'Pre-alerta rechazada',
  no_registrado: 'No registrado',
  consulta: 'Consulta',
};

// Cálculo de vista previa (el servidor recalcula al emitir).
export function lineAmounts(cbm, packages, rates) {
  const c = Number(cbm) || 0;
  const p = Math.max(0, Math.round(Number(packages) || 0));
  const shipping = c * (Number(rates?.rate_per_cbm) || 0);
  const door = c * (Number(rates?.door_to_door_per_cbm) || 0);
  const handling = p * (Number(rates?.handling_fee ?? 1));
  const r = (v) => Math.round(v * 100) / 100;
  return { shipping: r(shipping), door: r(door), handling: r(handling), total: r(shipping + door + handling) };
}