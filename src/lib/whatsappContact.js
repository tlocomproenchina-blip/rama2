/**
 * Construye una URL wa.me con un número de teléfono y un mensaje pre-llenado.
 * Limpia el número (deja solo dígitos) y omite el "+" inicial.
 * Devuelve null si el número no es válido.
 */
export function buildWhatsAppUrl(rawNumber, message = '') {
  if (!rawNumber) return null;
  const digits = String(rawNumber).replace(/\D/g, '');
  if (digits.length < 7) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${digits}${text}`;
}

/**
 * Genera un mensaje plantilla para contactar a un cliente sobre un paquete.
 */
export function buildPackageContactMessage(pkg, clientName) {
  const name = clientName ? clientName.split(' ')[0] : 'estimado cliente';
  const tracking = pkg?.tracking_number || '';
  return `Hola ${name}, le contactamos de TLEC CARGO sobre su paquete con tracking ${tracking}.`;
}