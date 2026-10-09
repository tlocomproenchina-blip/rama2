// Rango ISO del período de días de Caracas (desde inclusive, hasta inclusive).
// Venezuela es UTC-4 todo el año: un día de Caracas empieza a las 04:00 UTC.
// Es el mismo criterio que usa la Orden de Despacho (shared/dispatchOrderSheet.ts),
// para que un período signifique exactamente lo mismo en las dos pantallas.
const CARACAS_UTC_HOUR = 4;

export function caracasRange(from, to) {
  const start = new Date(`${from}T0${CARACAS_UTC_HOUR}:00:00.000Z`);
  const end = new Date(`${to}T0${CARACAS_UTC_HOUR}:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { fromIso: start.toISOString(), toIso: end.toISOString() };
}