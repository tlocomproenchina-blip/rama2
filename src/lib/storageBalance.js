// Mismo cálculo que base44/shared/billingNotices.ts (Términos, sección VII):
// día 8 cargo único USD 100; desde el día 9, USD 20 por día continuo.
// Solo se muestra: la factura no se modifica.
import { billableTotal } from '@/lib/storageLines';

const DAY_MS = 86400000;
const OFFSET = 4 * 3600000; // Caracas
export const MIN_STORAGE_FEE = 100;
export const DAILY_STORAGE_FEE = 20;
export const MIN_STORAGE_DAY = 8;

const dayStart = (v) => {
  const d = new Date(new Date(v).getTime() - OFFSET);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

export function storageBalance(invoice, now = new Date()) {
  // Sin las líneas de almacenamiento ya registradas: se muestran abajo como cargo fijo y diario.
  const balance = Math.max(0, billableTotal(invoice) - Number(invoice?.paid_amount || 0));
  const stopped = ['pagada', 'cancelada', 'revision'].includes(invoice?.status) || balance <= 0.01;
  const day = invoice?.invoice_date ? Math.floor((dayStart(now) - dayStart(invoice.invoice_date)) / DAY_MS) : 0;
  const active = !stopped && day >= MIN_STORAGE_DAY;
  const dailyDays = active ? day - MIN_STORAGE_DAY : 0;
  const minFee = active ? MIN_STORAGE_FEE : 0;
  const dailyFee = dailyDays * DAILY_STORAGE_FEE;
  return { day, balance, active, minFee, dailyDays, dailyFee, total: balance + minFee + dailyFee };
}