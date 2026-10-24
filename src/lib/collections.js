// Reglas de cobranza, reutilizando la facturación vigente:
// · Una factura se considera vencida a los 20 días de emitida (mismo criterio que
//   la pestaña "Vencidas" de Gestión de Facturas).
// · Los tramos de aviso siguen los hitos de antigüedad que ya usa la app
//   (20, 30 y 45 días), y el de 45 días es el mismo del contrato de almacenamiento.
// · El texto del recordatorio cambia de tono según esos días vencidos y se envía
//   por los mismos canales de notificación (email y WhatsApp).
import { publicAppUrl } from '@/lib/publicLinks';

export const OVERDUE_DAYS = 20;
export const PENDING_STATUSES = ['pendiente', 'revision', 'vencida'];
export const INVOICE_PANEL_URL = publicAppUrl('/MyInvoices');

export const OVERDUE_BUCKET_LABELS = {
  por_vencer: 'Por vencer',
  leve: 'Vencida 1-10 días',
  media: 'Vencida 11-29 días',
  alta: 'Vencida 30-44 días',
  critica: 'Vencida 45+ días',
};

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const invoiceBalance = (invoice) =>
  Math.max(0, Number(invoice?.total || 0) - Number(invoice?.paid_amount || 0));

export const invoiceClientName = (invoice) => {
  const full = `${invoice?.client_first_name || ''} ${invoice?.client_last_name || ''}`.trim();
  return full || invoice?.client_email || '—';
};

// Días transcurridos desde la emisión y días vencidos (0 mientras no supere los 20).
export function invoiceAging(invoice, now = Date.now()) {
  const issued = toDate(invoice?.invoice_date);
  const daysSince = issued ? Math.max(0, Math.floor((now - issued.getTime()) / 86400000)) : 0;
  const daysOverdue = Math.max(0, daysSince - OVERDUE_DAYS);
  return {
    daysSince,
    daysOverdue,
    daysLeft: Math.max(0, OVERDUE_DAYS - daysSince),
    bucket:
      daysOverdue === 0 ? 'por_vencer'
        : daysOverdue <= 10 ? 'leve'
          : daysOverdue <= 29 ? 'media'
            : daysOverdue <= 44 ? 'alta'
              : 'critica',
  };
}

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

const formatDate = (value) => {
  const date = toDate(value);
  return date ? date.toLocaleDateString('es-VE') : '—';
};

const OPENERS = {
  por_vencer: (ctx) => `Te recordamos que tu factura ${ctx.number} por ${ctx.saldo} sigue pendiente de pago y vence en ${ctx.daysLeft} día(s) (emitida el ${ctx.fecha}).`,
  leve: (ctx) => `Tu factura ${ctx.number} por ${ctx.saldo} tiene ${ctx.daysOverdue} día(s) de vencida (emitida el ${ctx.fecha}).`,
  media: (ctx) => `Tu factura ${ctx.number} por ${ctx.saldo} acumula ${ctx.daysOverdue} día(s) de vencida (emitida el ${ctx.fecha}).`,
  alta: (ctx) => `Tu factura ${ctx.number} por ${ctx.saldo} acumula ${ctx.daysOverdue} días de vencida (emitida el ${ctx.fecha}).`,
  critica: (ctx) => `Tu factura ${ctx.number} por ${ctx.saldo} acumula ${ctx.daysOverdue} días de vencida (emitida el ${ctx.fecha}).`,
};

const NOTES = {
  por_vencer: 'Puedes adelantar el pago cuando quieras para que tu carga salga sin demoras.',
  leve: 'Puedes revisar el detalle y pagar desde tu panel en pocos minutos.',
  media: 'Para evitar cargos por almacenamiento y retrasos en la entrega de tu carga, te pedimos regularizar el pago.',
  alta: 'La carga sigue en almacén y los cargos por custodia continúan sumándose, por lo que te pedimos ponerte al día a la brevedad.',
  critica: 'Al superar los 45 días la carga queda sujeta a las condiciones del contrato de almacenamiento, así que es importante regularizar hoy.',
};

// Mensaje del botón "Notificar pago": asunto y cuerpo de email + versión corta
// para WhatsApp, ajustados a los días vencidos de la factura.
export function collectionMessage(invoice, aging = invoiceAging(invoice)) {
  const bucket = aging.bucket || 'por_vencer';
  const ctx = {
    nombre: String(invoice?.client_first_name || '').trim().split(' ')[0] || 'estimado cliente',
    number: invoice?.invoice_number || '—',
    saldo: money(invoiceBalance(invoice)),
    fecha: formatDate(invoice?.invoice_date),
    daysOverdue: aging.daysOverdue,
    daysLeft: aging.daysLeft,
    link: INVOICE_PANEL_URL,
  };

  const subject = aging.daysOverdue > 0
    ? `Pago pendiente · Factura ${ctx.number} vencida hace ${aging.daysOverdue} día(s)`
    : `Recordatorio de pago · Factura ${ctx.number}`;

  const body = [
    `Hola ${ctx.nombre},`,
    '',
    OPENERS[bucket](ctx),
    NOTES[bucket],
    '',
    `Saldo pendiente: ${ctx.saldo}`,
    `Revisa el detalle y paga aquí: ${ctx.link}`,
    '',
    'Si ya realizaste el pago, ignora este mensaje y envíanos el comprobante.',
    '',
    'TLEC CARGO',
  ].join('\n');

  const whatsapp = [
    `Hola ${ctx.nombre}, te escribimos de TLEC CARGO.`,
    OPENERS[bucket](ctx),
    NOTES[bucket],
    `Puedes ver y pagar tu factura aquí: ${ctx.link}`,
  ].join(' ');

  return { subject, body, whatsapp, bucket };
}