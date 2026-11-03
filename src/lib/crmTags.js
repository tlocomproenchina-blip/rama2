// Etiquetas del CRM: las automáticas las calcula el servidor; las manuales las
// crea y asigna el equipo. En la bandeja viajan como 'auto:clave' o 'manual:nombre'.
export const AUTO_TAGS = {
  mayorista: { label: 'Mayorista', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  con_deuda: { label: 'Con deuda', className: 'bg-red-100 text-red-700 border-red-200' },
  cliente_nuevo: { label: 'Cliente nuevo', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  en_almacen: { label: 'Carga en almacén', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  en_camino: { label: 'Paquetes en camino', className: 'bg-sky-100 text-sky-700 border-sky-200' },
};

export const TAG_COLORS = {
  gray: 'bg-slate-100 text-slate-700 border-slate-200',
  blue: 'bg-blue-100 text-blue-700 border-blue-200',
  green: 'bg-green-100 text-green-700 border-green-200',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  red: 'bg-rose-100 text-rose-700 border-rose-200',
  purple: 'bg-violet-100 text-violet-700 border-violet-200',
  pink: 'bg-pink-100 text-pink-700 border-pink-200',
};

export function describeTag(tag, catalog = []) {
  const [kind, ...rest] = String(tag).split(':');
  const key = rest.join(':');
  if (kind === 'auto') return { label: AUTO_TAGS[key]?.label || key, className: AUTO_TAGS[key]?.className || TAG_COLORS.gray };
  const found = catalog.find((c) => c.name === key);
  return { label: key, className: TAG_COLORS[found?.color] || TAG_COLORS.blue };
}