// Códigos de bloque del almacén: bultos sueltos y cajas consolidadas.
// El bulto suelto usa {shipping_mark}-B{##} y la caja que agrupa bultos pequeños usa
// {shipping_mark}-C{##}. La letra distingue los dos tipos sin cambiar el shipping mark
// del cliente, así que cualquier etiqueta dice de quién es la carga con solo leerla.

// Caja consolidada (etiqueta continua con código de barras).
export const CAJA_CODE_RE = /-C\d+$/i;

// Bulto suelto.
export const BULTO_CODE_RE = /-B\d+$/i;

// Cualquiera de los dos: es lo que se despacha desde el escáner.
export const BLOCK_CODE_RE = /-[BC]\d+$/i;

export const isCajaCode = (code) => CAJA_CODE_RE.test(String(code || '').trim());

export const isBultoCode = (code) => BULTO_CODE_RE.test(String(code || '').trim());

export const isBlockCode = (code) => BLOCK_CODE_RE.test(String(code || '').trim());

// El prefijo del código es el shipping mark del cliente.
export const markOfBlockCode = (code) => {
  const match = String(code || '').trim().match(/^(.*?)-[BC]\d+$/i);
  return match ? match[1].trim().toUpperCase() : '';
};

// Número que trae el código (el que reservó el almacén al abrir el bloque).
export const blockNumberFromCode = (code) => {
  const match = String(code || '').trim().match(/-([BC])(\d+)$/i);
  return match ? Number(match[2]) : null;
};

// Código de una caja del cliente: {shipping_mark}-C{número reservado}.
export const buildCajaCode = (shippingMark, number) =>
  `${String(shippingMark || '').trim()}-C${Number(number) || 0}`;