// Rango de fechas en hora de Caracas (UTC-4, sin horario de verano) para los
// reportes de rendimiento. Las fechas guardadas no llevan zona: se comparan como
// texto ISO sin la "Z", igual que el resto de los reportes.

const CARACAS_OFFSET_HOURS = 4;
const MAX_DAYS = 92;

export function isDateStr(value: any) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

export function caracasRange(dateFrom: string, dateTo: string) {
  const start = new Date(`${dateFrom}T00:00:00.000Z`);
  start.setUTCHours(CARACAS_OFFSET_HOURS);
  const lastDay = new Date(`${dateTo}T00:00:00.000Z`);
  lastDay.setUTCHours(CARACAS_OFFSET_HOURS);
  const end = new Date(lastDay.getTime() + 24 * 3600 * 1000);
  const days = Math.round((end.getTime() - start.getTime()) / (24 * 3600 * 1000));
  const fmt = (d: Date) => d.toISOString().replace('Z', '');
  return { from: fmt(start), to: fmt(end), fromMs: start.getTime(), toMs: end.getTime(), days };
}

// Valida y normaliza { date, date_to } del cuerpo de la petición.
export function parseDates(body: any): { dateFrom: string; dateTo: string } | { error: string } {
  const dateFrom = String(body?.date || '');
  const dateTo = String(body?.date_to || dateFrom);
  if (!isDateStr(dateFrom) || !isDateStr(dateTo)) return { error: 'date (YYYY-MM-DD) is required' };
  if (dateTo < dateFrom) return { error: 'date_to must not be before date' };
  if (caracasRange(dateFrom, dateTo).days > MAX_DAYS) return { error: `El periodo máximo es de ${MAX_DAYS} días` };
  return { dateFrom, dateTo };
}

export function toMs(value: any) {
  if (!value) return NaN;
  const s = String(value);
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`).getTime();
}