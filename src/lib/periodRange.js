// Periodos de consulta del dashboard de rendimiento, en hora de Caracas.

export function getTodayInCaracas() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function shiftDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const PERIOD_PRESETS = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'mes', label: 'Este mes' },
  { value: 'rango', label: 'Rango personalizado' },
];

// Devuelve { from, to } (YYYY-MM-DD, ambos incluidos). La semana empieza el lunes.
export function rangeForPreset(preset, custom) {
  const today = getTodayInCaracas();
  if (preset === 'hoy') return { from: today, to: today };
  if (preset === 'semana') {
    const weekday = new Date(`${today}T00:00:00.000Z`).getUTCDay(); // 0 = domingo
    return { from: shiftDays(today, -((weekday + 6) % 7)), to: today };
  }
  if (preset === 'mes') return { from: `${today.slice(0, 8)}01`, to: today };
  return { from: custom?.from || today, to: custom?.to || today };
}

export function formatRangeLabel({ from, to }) {
  const fmt = (s) => s.split('-').reverse().join('/');
  return from === to ? fmt(from) : `${fmt(from)} al ${fmt(to)}`;
}