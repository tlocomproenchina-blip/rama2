// Mismo criterio que src/lib/cbmReconciliation.js: el ajuste sin cliente
// AJUSTE-CONCILIACION concilia las facturas 1–380 con el Excel de China.
export const RECON_ADJUSTMENT_CODE = 'AJUSTE-CONCILIACION';
export const RECON_RANGE = { from: 1, to: 380 };

export const isReconAdjustment = (item: any) =>
  String(item?.invoice_number || '').toUpperCase() === RECON_ADJUSTMENT_CODE;

export const reconciledCbm = (records: any[]) =>
  (records || []).reduce((s, r) => {
    const n = parseFloat(r.invoice_number);
    const inRange = Number.isFinite(n) && n >= RECON_RANGE.from && n <= RECON_RANGE.to;
    return inRange || isReconAdjustment(r) ? s + (Number(r.cbm) || 0) : s;
  }, 0);