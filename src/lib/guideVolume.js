// Volumen de la guía de despacho: CBM y su conversión a pies cúbicos.
// Conversión usada por la empresa: 1 CBM = 35 pies cúbicos.
export const CUBIC_FEET_PER_CBM = 35;

export const sumCbm = (lines = []) =>
  (Array.isArray(lines) ? lines : []).reduce((sum, line) => sum + (Number(line?.cbm) || 0), 0);

export const volumeLabel = (cbm) => {
  const value = Number(cbm) || 0;
  return `${value.toFixed(3)} CBM = ${(value * CUBIC_FEET_PER_CBM).toFixed(2)} pies cúbicos`;
};