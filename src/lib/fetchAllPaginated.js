import { base44 } from '@/components/api/ApiQueueManager';

/**
 * Trae TODOS los registros de una entidad usando .list() o .filter() de forma paginada.
 *
 * Útil cuando se necesita el dataset completo (ej: cálculo de totales, exports, agregaciones)
 * y no se confía en el límite por defecto del backend.
 *
 * Uso:
 *   const all = await fetchAllPaginated('Invoice', { method: 'filter', query: { status: 'pendiente' }, sort: '-invoice_date' });
 *   const all = await fetchAllPaginated('CbmIngreso', { sort: '-fecha' });
 *
 * @param {string} entityName    Nombre de la entidad
 * @param {Object} options
 * @param {string} options.method   'list' o 'filter' (default: 'list')
 * @param {Object} options.query    Para method='filter', filtros a aplicar
 * @param {string} options.sort     Campo de ordenamiento (ej: '-created_date')
 * @param {number} options.batchSize  Tamaño de cada página (default 200)
 * @param {number} options.maxItems   Tope de seguridad (default 50000)
 * @returns {Promise<Array>}
 */
export async function fetchAllPaginated(entityName, options = {}) {
  const { method = 'list', query, sort, batchSize = 200, maxItems = 50000 } = options;
  const all = [];
  let skip = 0;

  while (all.length < maxItems) {
    let batch;
    if (method === 'filter') {
      batch = await base44.entities[entityName].filter(query || {}, sort, batchSize, skip);
    } else {
      batch = await base44.entities[entityName].list(sort, batchSize, skip);
    }
    if (!batch || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < batchSize) break;
    skip += batchSize;
  }

  return all;
}