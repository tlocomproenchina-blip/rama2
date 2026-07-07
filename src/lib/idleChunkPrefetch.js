// Precarga en segundo plano los chunks JS de las páginas admin más usadas,
// para que al navegar no haya que esperar la descarga del módulo.
// Solo descarga código (no datos), en momentos de inactividad del navegador.

const CHUNKS = [
  () => import('@/pages/AccountingDashboard'),
  () => import('@/pages/AdminRevenueDashboard'),
  () => import('@/pages/AdminInvoices'),
  () => import('@/pages/AdminManualBilling'),
  () => import('@/pages/AdminCbmIngresos'),
  () => import('@/pages/AdminEmailHistory'),
  () => import('@/pages/AdminClients'),
  () => import('@/pages/AdminOperaciones'),
];

let started = false;

export function prefetchAdminChunks() {
  if (started) return;
  started = true;

  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
  let i = 0;

  const loadNext = () => {
    if (i >= CHUNKS.length) return;
    const load = CHUNKS[i++];
    load().catch(() => {}).finally(() => idle(loadNext));
  };

  // Esperar a que la página actual termine de cargar antes de precargar
  idle(loadNext);
}