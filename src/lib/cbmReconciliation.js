// Ajuste contable sin cliente que concilia las facturas 1–380 con el Excel de China.
// No pertenece a un período real: se excluye de los totales por fecha y solo
// se suma cuando se consulta un rango de facturas que cubre todo 1–380.
export const RECON_ADJUSTMENT_CODE = 'AJUSTE-CONCILIACION';
export const RECON_RANGE = { from: 1, to: 380 };

export const isReconAdjustment = (item) =>
  String(item?.invoice_number || '').toUpperCase() === RECON_ADJUSTMENT_CODE;

export const rangeCoversRecon = (fromNum, toNum) =>
  (fromNum === null || fromNum <= RECON_RANGE.from) && (toNum === null || toNum >= RECON_RANGE.to);

export const sumCbm = (list) => (list || []).reduce((s, i) => s + Number(i.cbm || 0), 0);