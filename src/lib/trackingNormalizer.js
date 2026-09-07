/**
 * Dado un tracking escaneado (posible sub-tracking), retorna una lista de
 * candidatos ordenados por probabilidad de coincidencia:
 *   1. El código original tal cual
 *   2. Versiones con 3, 2, 4, 1, 5, 6 dígitos removidos del final
 *
 * El sufijo de 3 dígitos (001, 002, …) es el patrón más común en etiquetas
 * chinas donde el código de barras del sub-bulto extiende el tracking master.
 *
 * Ningún candidato menor a 5 caracteres se incluye.
 */
export function getTrackingCandidates(rawTracking) {
  const code = String(rawTracking || '').trim();
  if (!code) return [];

  // Orden de remoción: 3 primero (patrón más común), luego 2, 4, 1, 5, 6
  const removalOrder = [0, 3, 2, 4, 1, 5, 6];
  const seen = new Set();
  const candidates = [];

  for (const remove of removalOrder) {
    if (remove === 0) {
      if (!seen.has(code)) {
        seen.add(code);
        candidates.push(code);
      }
      continue;
    }
    if (code.length - remove < 5) continue;
    const candidate = code.slice(0, code.length - remove);
    if (!seen.has(candidate)) {
      seen.add(candidate);
      candidates.push(candidate);
    }
  }

  return candidates;
}

/**
 * Versión lowercased para comparaciones case-insensitive en memoria
 * (ej. WarehousePickPackShip que compara contra una lista ya cargada).
 */
export function getTrackingCandidatesLower(rawTracking) {
  return getTrackingCandidates(rawTracking).map((c) => c.toLowerCase());
}