// Plazo del comprobante de entrega: 10 días naturales desde la pre-alerta.
//
// El plazo solo corre para los trackings registrados desde el 5 de octubre de
// 2026 (00:00 hora de Caracas). Los registrados antes de esa fecha quedan fuera:
// no se les envía el aviso ni se les bloquea la carga de la fecha de entrega del
// vendedor y su foto.
export const DELIVERY_PROOF_DAYS = 10;

// 5 de octubre de 2026, 00:00 en Caracas (UTC-4).
export const DELIVERY_PROOF_START_ISO = '2026-10-05T04:00:00.000Z';

export function isDeliveryProofTracked(pkg: any): boolean {
  const created = pkg?.created_date;
  if (!created) return false;
  const ms = new Date(created).getTime();
  if (Number.isNaN(ms)) return false;
  return ms >= new Date(DELIVERY_PROOF_START_ISO).getTime();
}