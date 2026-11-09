// Línea de la etiqueta que antes decía "BULTO N": ahora lleva el N° de contenedor
// (factura del ingreso CBM). El número de bulto ya no se imprime.
export function containerLine(bulto) {
  const orders = Array.isArray(bulto?.cbm_order_numbers)
    ? [...new Set(bulto.cbm_order_numbers.map((o) => String(o || '').trim()).filter(Boolean))]
    : [];
  if (orders.length) return `CONTENEDOR ${orders.join(', ')}`;
  return bulto?.is_caja ? 'CAJA CONSOLIDADA' : 'SIN CONTENEDOR';
}