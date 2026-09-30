// Búsqueda de bultos por el final del código de etiqueta (shipping_mark-B####).
// En el almacén casi nunca se tiene el código completo a mano, así que la búsqueda
// acepta el fragmento final con o sin guiones, espacios y prefijo "B"
// (por ejemplo B50021, 50021 o 0021) y la resuelve el servidor; los bultos que
// todavía viven solo en este dispositivo se agregan desde el caché local.
import { base44 } from '@/components/api/ApiQueueManager';
import { getAll } from '@/lib/offlineDb';

export const MIN_CODE_QUERY = 3;

// Normaliza el texto tecleado y los códigos: sin guiones, espacios ni mayúsculas.
export function normalizeBultoCode(raw) {
  return String(raw ?? '').trim().toLowerCase().replace(/[\s\-_]/g, '');
}

// Condición de búsqueda anclada al final del código (null si el texto es muy corto).
export function bultoCodeTail(raw) {
  const q = normalizeBultoCode(raw);
  if (q.length < MIN_CODE_QUERY) return null;
  return { $regex: `${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' };
}

// ¿La etiqueta termina con lo que se escribió? (mismo criterio que el servidor)
export function matchesBultoCode(labelCode, raw) {
  const q = normalizeBultoCode(raw);
  if (!labelCode || q.length < MIN_CODE_QUERY) return false;
  if (normalizeBultoCode(labelCode).endsWith(q)) return true;
  // Código completo escrito (con shipping mark y guiones): comparación directa.
  const loose = String(raw ?? '').trim().toLowerCase();
  return loose.length >= MIN_CODE_QUERY && String(labelCode).toLowerCase().includes(loose);
}

// Une listas de bultos sin repetir (por id y por código de etiqueta).
export function mergeBultos(...lists) {
  const seenIds = new Set();
  const seenCodes = new Set();
  const out = [];
  for (const list of lists) {
    for (const b of Array.isArray(list) ? list : []) {
      if (!b) continue;
      const id = String(b.id || '');
      const code = String(b.label_code || '').toUpperCase();
      if (id && seenIds.has(id)) continue;
      if (code && seenCodes.has(code)) continue;
      if (id) seenIds.add(id);
      if (code) seenCodes.add(code);
      out.push(b);
    }
  }
  return out;
}

// Busca en el servidor por el final del código y completa con los bultos que aún
// no se han sincronizado desde este dispositivo.
export async function searchBultosByCode(raw, { limit = 50 } = {}) {
  const tail = bultoCodeTail(raw);
  if (!tail) return [];
  const results = [];
  try {
    const rows = await base44.entities.Bulto.filter({ label_code: tail }, '-created_date', limit);
    results.push(...(Array.isArray(rows) ? rows : rows?.items || []));
  } catch (_) {}
  try {
    const locals = await getAll('bultos');
    locals
      .filter((b) => matchesBultoCode(b.label_code, raw))
      .forEach((b) => results.push({ ...b, is_local_pending: !b.synced && !b.server_bulto_id }));
  } catch (_) {}
  return mergeBultos(results);
}