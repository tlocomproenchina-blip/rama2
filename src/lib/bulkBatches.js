// Procesa una lista de operaciones en lotes pequeños y tolerantes a fallos.
//
// Antes las acciones masivas lanzaban bloques de 10 actualizaciones con
// Promise.all: si UNA fallaba (por ejemplo un 429 al recibir decenas de
// paquetes seguidos) se abortaba el Promise.all y se perdía todo lo que venía
// después. Aquí cada elemento se resuelve por separado, los que fallan se
// reintentan una vez y el resto continúa siempre.

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {Array} items       Elementos a procesar.
 * @param {Function} worker   async (item) => resultado. Debe lanzar si falla.
 * @param {Object} opts       chunkSize, pauseMs, retries, retryDelayMs, onProgress
 * @returns {Promise<{ok: Array, failed: Array<{item, error}>, total: number}>}
 */
export async function runBatched(items, worker, opts = {}) {
  const chunkSize = Math.max(1, opts.chunkSize || 5);
  const pauseMs = opts.pauseMs != null ? opts.pauseMs : 300;
  const retries = opts.retries != null ? opts.retries : 1;
  const retryDelayMs = opts.retryDelayMs != null ? opts.retryDelayMs : 2000;
  const { onProgress } = opts;

  const total = (items || []).length;
  const ok = [];
  const errors = new Map();
  let last = null;

  const report = (attempt) => {
    try {
      onProgress?.({
        done: ok.length + errors.size,
        total,
        failed: errors.size,
        attempt,
        last,
      });
    } catch (_) { /* la UI nunca debe romper el proceso */ }
  };

  const runPass = async (list, attempt) => {
    const pending = [];
    for (let i = 0; i < list.length; i += chunkSize) {
      const chunk = list.slice(i, i + chunkSize);
      const settled = await Promise.allSettled(chunk.map((item) => worker(item)));
      settled.forEach((res, idx) => {
        const item = chunk[idx];
        if (res.status === 'fulfilled') {
          ok.push(item);
          errors.delete(item);
        } else {
          errors.set(item, res.reason);
          pending.push(item);
          last = item;
        }
      });
      report(attempt);
      if (i + chunkSize < list.length && pauseMs > 0) await wait(pauseMs);
    }
    return pending;
  };

  let pending = await runPass(items || [], 1);
  for (let attempt = 1; attempt <= retries && pending.length > 0; attempt++) {
    await wait(retryDelayMs * attempt);
    pending = await runPass(pending, attempt + 1);
  }

  return {
    ok,
    failed: pending.map((item) => ({ item, error: errors.get(item) })),
    total,
  };
}