// Etiqueta compacta de la carga de un cliente o de una ciudad: solo lo que el
// almacén tiene que sacar (cajas consolidadas y bultos sueltos, sin subtotales largos).
export function unitsLabel(cajas, bultos) {
  const parts = [];
  if (Number(cajas) > 0) parts.push(`${Number(cajas)} caja(s)`);
  if (Number(bultos) > 0) parts.push(`${Number(bultos)} bulto(s)`);
  return parts.length ? parts.join(' + ') : '0 bulto(s)';
}