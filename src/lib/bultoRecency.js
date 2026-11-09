// Orden del historial: el bulto creado más recientemente siempre arriba.
// Las fechas del servidor llegan sin zona horaria (son UTC); las locales traen "Z".
const toMs = (value) => {
  if (!value) return 0;
  const s = String(value);
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
};

export const bultoCreatedMs = (b) => toMs(b?.created_date || b?.closed_at);

export const sortNewestFirst = (bultos) =>
  [...(bultos || [])].sort((a, b) => bultoCreatedMs(b) - bultoCreatedMs(a));