// Plazo para cargar el comprobante de entrega: 10 días naturales contados desde
// que se creó la pre-alerta. Vencido el plazo, el cliente ya no puede cargar ni
// editar la fecha de entrega del vendedor ni su foto, salvo que un administrador
// haya habilitado la excepción del paquete (delivery_proof_exception).
//
// El plazo solo corre para los trackings registrados desde el 5 de octubre de
// 2026 (00:00 hora de Caracas): los registrados antes de esa fecha quedan fuera,
// así que no se les avisa ni se les bloquea la carga.
export const DELIVERY_PROOF_DAYS = 10;

export const DELIVERY_PROOF_START = '2026-10-05T04:00:00.000Z';

export function isDeliveryProofTracked(pkg) {
  const created = pkg?.created_date;
  if (!created) return false;
  const ms = new Date(created).getTime();
  if (Number.isNaN(ms)) return false;
  return ms >= new Date(DELIVERY_PROOF_START).getTime();
}

export const DELIVERY_PROOF_ALERT =
  'Ya venció el plazo de 10 días desde tu pre-alerta para cargar la fecha de entrega y su foto. En este momento tu carga podría no localizarse en el almacén. Si tu paquete todavía no aparece como recibido en el almacén de China, abre un ticket en Soporte.';

const DAY_MS = 24 * 60 * 60 * 1000;

export function getDeliveryProofDeadline(pkg) {
  if (!isDeliveryProofTracked(pkg)) return null;
  const created = pkg?.created_date;
  if (!created) return null;
  const base = new Date(created);
  if (Number.isNaN(base.getTime())) return null;
  const deadline = new Date(base);
  deadline.setDate(deadline.getDate() + DELIVERY_PROOF_DAYS);
  return deadline;
}

// expired: el cliente ya no puede cargar (plazo vencido y sin excepción).
// pastDeadline: el plazo venció, con o sin excepción (el admin necesita verlo igual).
export function getDeliveryProofState(pkg) {
  const deadline = getDeliveryProofDeadline(pkg);
  if (!deadline) return { hasDeadline: false, expired: false, pastDeadline: false, exception: false, deadline: null, daysLeft: null, showAlert: false, hasDeliveryInfo: false };
  const exception = !!pkg?.delivery_proof_exception;
  const msLeft = deadline.getTime() - Date.now();
  const pastDeadline = msLeft <= 0;
  const expired = pastDeadline && !exception;
  const hasDeliveryInfo = !!(pkg?.seller_delivery_date || pkg?.seller_delivery_photo_uri);
  return {
    hasDeadline: true,
    deadline,
    exception,
    pastDeadline,
    expired,
    daysLeft: Math.ceil(msLeft / DAY_MS),
    hasDeliveryInfo,
    // El aviso al cliente solo aplica a paquetes que siguen en pre-alerta y que
    // todavía no tienen fecha ni foto de entrega del vendedor: si la carga ya fue
    // recibida en el almacén, el aviso deja de tener sentido.
    showAlert: expired && pkg?.status === 'pre_alerta' && !hasDeliveryInfo,
  };
}

export function formatDeliveryProofDeadline(deadline) {
  if (!deadline) return '';
  return deadline.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}