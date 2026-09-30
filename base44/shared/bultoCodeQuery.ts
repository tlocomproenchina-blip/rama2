// Consulta de bultos por el final del código de etiqueta (shipping_mark-B####).
// El almacén suele tener a mano solo los últimos caracteres de la etiqueta, así que
// la búsqueda acepta el fragmento final con o sin guiones, espacios y prefijo "B"
// (por ejemplo B50021, 50021 o 0021) y lo resuelve con una coincidencia anclada al
// final del código, sin distinguir mayúsculas.

export const MIN_CODE_QUERY = 3;

// Normaliza el texto tecleado: sin guiones, espacios ni mayúsculas.
export function normalizeCodeQuery(raw: any): string {
  return String(raw ?? "").trim().toLowerCase().replace(/[\s\-_]/g, "");
}

// Expresión regular anclada al final para el fragmento tecleado.
// Devuelve null cuando el texto es demasiado corto para buscar.
export function codeTailRegex(raw: any): string | null {
  const q = normalizeCodeQuery(raw);
  if (q.length < MIN_CODE_QUERY) return null;
  return `${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`;
}