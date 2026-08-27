/**
 * Guardián de chunks obsoletos.
 *
 * Cuando el navegador mezcla módulos de dos optimizaciones distintas de Vite
 * (dos copias de React), el primer render falla con:
 *   "Cannot read properties of null (reading 'useState')"
 *   o "Invalid hook call"
 *
 * En ese caso el estado es irrecuperable: la única salida es limpiar Service
 * Workers + caches y recargar sin caché. Este guardián lo hace UNA sola vez
 * por sesión para no entrar en bucle de recargas.
 */

const RECOVERY_FLAG = 'tlec-stale-chunk-recovered';

const DUPLICATE_REACT_SIGNATURES = [
  "reading 'useState'",
  'reading "useState"',
  "reading 'useEffect'",
  "reading 'useContext'",
  "reading 'useRef'",
  'Invalid hook call',
  'Cannot read properties of null (reading \'useMemo\')'
];

function looksLikeDuplicateReact(message) {
  if (!message) return false;
  return DUPLICATE_REACT_SIGNATURES.some((sig) => message.includes(sig));
}

async function hardRecover() {
  try {
    sessionStorage.setItem(RECOVERY_FLAG, '1');
  } catch (_) {}

  // 1. Desregistrar todos los Service Workers
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => {})));
    }
  } catch (_) {}

  // 2. Borrar todas las caches
  try {
    if (window.caches && caches.keys) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => {})));
    }
  } catch (_) {}

  // 3. Recargar forzando red (cache-buster en la URL)
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('_fresh', Date.now().toString(36));
    window.location.replace(url.toString());
  } catch (_) {
    window.location.reload();
  }
}

export function installStaleChunkGuard() {
  // Si ya intentamos recuperar en esta sesión, no repetir (evita bucle)
  let alreadyRecovered = false;
  try {
    alreadyRecovered = sessionStorage.getItem(RECOVERY_FLAG) === '1';
  } catch (_) {}

  // Limpiar el parámetro cache-buster de la URL para no ensuciarla
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('_fresh')) {
      url.searchParams.delete('_fresh');
      window.history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
    }
  } catch (_) {}

  if (alreadyRecovered) return;

  const handler = (event) => {
    const message = event?.error?.message || event?.message || '';
    if (looksLikeDuplicateReact(message)) {
      window.removeEventListener('error', handler);
      console.warn('[TLEC] Detectada copia duplicada de React (chunks obsoletos). Recuperando...');
      hardRecover();
    }
  };

  window.addEventListener('error', handler);

  window.addEventListener('unhandledrejection', (event) => {
    const message = event?.reason?.message || '';
    if (looksLikeDuplicateReact(message)) {
      console.warn('[TLEC] Detectada copia duplicada de React (promesa). Recuperando...');
      hardRecover();
    }
  });
}