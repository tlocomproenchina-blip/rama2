import { downloadTxt } from '@/lib/paymentReportTxt';

// Número listo para wa.me: solo dígitos (quita +, espacios, guiones y paréntesis).
export function cleanWhatsappPhone(value) {
  return String(value || '').replace(/\D/g, '');
}

// Enlace de WhatsApp con la orden ya escrita. Devuelve null si no hay número.
export function buildWhatsappLink(phone, message) {
  const digits = cleanWhatsappPhone(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(String(message || ''))}`;
}

// Descarga la orden tal como se manda por WhatsApp.
export function downloadDispatchOrderTxt(sheet, text) {
  const name = `orden_despacho_${sheet?.period_from || ''}_a_${sheet?.period_to || ''}.txt`;
  downloadTxt(name, text);
}