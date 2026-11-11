// Volumen de la guía de despacho: CBM y su conversión a pies cúbicos.
// Conversión usada por la empresa: 1 CBM = 35 pies cúbicos.
export const CUBIC_FEET_PER_CBM = 35;

export const sumCbm = (lines = []) =>
  (Array.isArray(lines) ? lines : []).reduce((sum, line) => sum + (Number(line?.cbm) || 0), 0);

// CBM de un cliente de la guía: el de sus bultos o, si no tienen, el facturado
// guardado en los totales del cliente (viene de la factura vinculada).
export const clientCbm = (client) => sumCbm(client?.bultos) || Number(client?.totals?.cbm) || 0;

export const volumeLabel = (cbm) => {
  const value = Number(cbm) || 0;
  return `${value.toFixed(3)} CBM = ${(value * CUBIC_FEET_PER_CBM).toFixed(2)} pies cúbicos`;
};