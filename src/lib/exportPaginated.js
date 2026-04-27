import { base44 } from '@/components/api/ApiQueueManager';

/**
 * Descarga TODOS los registros de una función backend paginada.
 *
 * Asume que la función devuelve { data: { data: [...], total: N, hasMore: bool } }
 * (formato estándar de listClientsForSupport, listPackagesForSupport, etc).
 *
 * @param {string} functionName     Nombre de la función backend
 * @param {Object} baseParams       Parámetros base (filtros, etc) que se mantienen entre páginas
 * @param {Object} options
 * @param {number} options.batchSize        Tamaño de página (default 200)
 * @param {Function} options.onProgress     Callback({ total, remaining, label }) para feedback de progreso
 * @param {string} options.label            Etiqueta a pasar al onProgress (default 'Descargando')
 * @param {number} options.maxItems         Tope de seguridad para evitar bucles infinitos (default 50000)
 * @returns {Promise<Array>}                Array con todos los registros agregados
 */
export async function exportPaginated(functionName, baseParams = {}, options = {}) {
  const { batchSize = 200, onProgress, label = 'Descargando', maxItems = 50000 } = options;

  const first = await base44.functions.invoke(functionName, {
    limit: batchSize,
    skip: 0,
    includeCounts: false,
    ...baseParams,
  });

  const all = [...(first?.data?.data || [])];
  const total = first?.data?.total || all.length;
  onProgress?.({ total, remaining: Math.max(0, total - all.length), label });

  while (all.length < total && all.length < maxItems) {
    const more = await base44.functions.invoke(functionName, {
      limit: batchSize,
      skip: all.length,
      includeCounts: false,
      ...baseParams,
    });
    const batch = more?.data?.data || [];
    if (batch.length === 0) break;
    all.push(...batch);
    onProgress?.({ total, remaining: Math.max(0, total - all.length), label });
    if (batch.length < batchSize) break;
  }

  return all;
}