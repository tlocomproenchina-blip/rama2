// Precarga en segundo plano los chunks JS de las páginas admin más usadas,
// para que al navegar no haya que esperar la descarga del módulo.
// Solo descarga código (no datos), en momentos de inactividad del navegador.
// No precarga en teléfonos, con ahorro de datos o conexión lenta, ni para
// empleados con área (esas pantallas no las usan y solo gastan datos).
import { isAreaEmployee } from '@/lib/areaAccess';

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

function shouldSkip(user) {
  try {
    if (user && isAreaEmployee(user)) return true;
    if (window.innerWidth < 1024) return true;
    const conn = navigator.connection;
    if (conn?.saveData) return true;
    if (conn?.effectiveType && /(^|-)2g|3g/.test(conn.effectiveType)) return true;
  } catch (_) {}
  return false;
}

export function prefetchAdminChunks(user) {
  if (started) return;
  started = true;
  if (shouldSkip(user)) return;

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