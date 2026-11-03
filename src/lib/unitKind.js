// Nombre visible de una unidad de almacén: caja consolidada o bulto suelto.
export function unitKindLabel(b) {
  if (b?.is_caja) {
    return `Caja consolidada${b.caja_number ? ` ${b.caja_number}/${b.caja_total || '?'}` : ''}`;
  }
  return `Bulto suelto ${b?.bulto_number || 1}/${b?.total_bultos || b?.bulto_number || 1}`;
}