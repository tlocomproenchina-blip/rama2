// Lectura de los cargos automáticos de almacenamiento y custodia para el panel de
// facturas: totales registrados por factura, líneas vigentes en la factura y el
// estado de los avisos al cliente. Solo consulta: no calcula ni cobra nada.

import { base44 } from '@/api/base44Client';

export const money = (value) => `$${(Number(value) || 0).toFixed(2)}`;

const DAY_MS = 24 * 60 * 60 * 1000;
const CARACAS_OFFSET_MS = 4 * 60 * 60 * 1000;

const dayStart = (value) => {
  const d = new Date(new Date(value).getTime() - CARACAS_OFFSET_MS);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

export const asArray = (value) => (Array.isArray(value) ? value : value?.items || []);

// Día del contrato: la fecha de emisión es el día 1 y el cobro empieza el día 8.
export function contractDay(invoiceDate, now = new Date()) {
  const time = invoiceDate ? new Date(invoiceDate).getTime() : NaN;
  if (!Number.isFinite(time)) return 0;
  return Math.floor((dayStart(now) - dayStart(invoiceDate)) / DAY_MS) + 1;
}

export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Líneas de almacenamiento y montacargas que hoy están sumadas a la factura.
export function invoiceStorageLines(invoice) {
  const items = Array.isArray(invoice?.items) ? invoice.items : [];
  let storage = 0;
  let forklift = 0;
  let days = 0;
  for (const item of items) {
    const kind = item?.details?.kind;
    if (kind === 'storage_charge') {
      storage += Number(item.total) || 0;
      days += Number(item.details?.days) || 0;
    } else if (kind === 'forklift_charge') {
      forklift += Number(item.total) || 0;
    }
  }
  return { storage, forklift, total: storage + forklift, days };
}

// Avisos contractuales de almacenamiento que se marcan en la factura.
export function invoiceNotices(invoice) {
  return [
    { key: '20', days: 20, sent: !!invoice?.storage_notif_20_sent },
    { key: '30', days: 30, sent: !!invoice?.storage_notif_30_sent },
    { key: '45', days: 45, sent: !!invoice?.storage_notif_45_sent },
  ];
}

// A qué aviso corresponde el asunto de un email de almacenamiento.
export function noticeKeyFromSubject(subject) {
  const value = String(subject || '').toLowerCase();
  if (value.includes('remate')) return '45';
  if (value.includes('vencido')) return '30';
  if (value.includes('pol') && value.includes('almacenamiento')) return '20';
  if (value.includes('cargos de almacenamiento')) return 'cargo';
  return null;
}

// Total registrado por factura en un solo llamado al servidor.
export async function fetchStorageTotals() {
  const res = await base44.entities.StorageCharge.aggregate({
    groupBy: 'invoice_id',
    sum: ['amount', 'storage_amount', 'forklift_amount', 'days_count'],
    max: ['day_number', 'charge_date', 'notified_date'],
    count: true,
    limit: 1000,
  }).catch(() => null);

  const map = {};
  for (const row of res?.rows || []) {
    if (!row?.invoice_id) continue;
    map[row.invoice_id] = {
      total: Number(row.sum_amount) || 0,
      storage: Number(row.sum_storage_amount) || 0,
      forklift: Number(row.sum_forklift_amount) || 0,
      days: Number(row.sum_days_count) || 0,
      records: Number(row.count) || 0,
      lastDay: Number(row.max_day_number) || 0,
      lastChargeDate: row.max_charge_date || null,
      notifiedDate: row.max_notified_date || null,
    };
  }
  return map;
}

// Desglose día por día registrado para una factura.
export async function fetchInvoiceCharges(invoiceId) {
  if (!invoiceId) return [];
  const res = await base44.entities.StorageCharge
    .filter({ invoice_id: invoiceId }, { sort: '-day_number', limit: 100 })
    .catch(() => []);
  return asArray(res);
}

// Fechas de los avisos de almacenamiento enviados al cliente.
export async function fetchStorageNotices(clientEmail) {
  if (!clientEmail) return [];
  const res = await base44.entities.EmailLog.filter(
    { recipient_email: clientEmail, subject: { $regex: 'almacenamiento|remate', $options: 'i' } },
    { sort: '-sent_date', limit: 30, fields: ['subject', 'sent_date'] }
  ).catch(() => []);
  return asArray(res);
}