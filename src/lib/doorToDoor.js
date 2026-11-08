// Servicio puerta a puerta (calculadora marítima): tarifa única por CBM,
// sin importar el destino. Se cobra sobre el mayor CBM disponible entre el
// calculado por medidas y el CBM indicado por el usuario.
export const DOOR_TO_DOOR_RATE_PER_CBM = 150;

export function doorToDoorCharge({ dimensions, cbm }) {
  const l = parseFloat(dimensions?.length) || 0;
  const w = parseFloat(dimensions?.width) || 0;
  const h = parseFloat(dimensions?.height) || 0;
  const dimsCbm = l && w && h ? (l * w * h) / 1000000 : 0;
  const enteredCbm = parseFloat(cbm) || 0;
  const usedCbm = Math.max(dimsCbm, enteredCbm);
  let source = null;
  if (usedCbm > 0) source = dimsCbm >= enteredCbm ? 'medidas' : 'cbm';
  return {
    cbm: usedCbm,
    source,
    rate: DOOR_TO_DOOR_RATE_PER_CBM,
    charge: usedCbm * DOOR_TO_DOOR_RATE_PER_CBM
  };
}