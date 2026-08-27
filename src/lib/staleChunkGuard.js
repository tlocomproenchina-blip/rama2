/**
 * Guardián de chunks obsoletos (dos copias de React).
 *
 * Síntoma: "Cannot read properties of null (reading 'useState')" o
 * "Invalid hook call" durante el primer render, con dos hashes `?v=` distintos
 * en el stack (React de una optimización y ReactDOM de otra).
 *
 * Causa: el navegador conserva chunks de Vite de una optimización anterior
 * (cacheados como `immutable`) y los mezcla con los nuevos.
 *
 * Solución: limpiar Service Workers + todas las caches + recargar forzando red.
 * Con reintento acotado en el tiempo para no entrar en bucle infinito.
 */

const RECOVERY_KEY = 'tlec-stale-chunk-recovery';
const MAX_ATTEMPTS = 2;
const ATTEMPT_WINDOW_MS = 60000; // reintentos válidos dentro de 1 minuto

const DUPLICATE_REACT_SIGNATURES = [
  "reading 'useState'",
  "reading 'useEffect'",
  "reading 'useContext'",
  "reading 'useRef'",
  "reading 'useMemo'",
  "reading 'useCallback'",
  "reading 'useLayoutEffect'",
  "reading 'useReducer'",
  'Invalid hook call',
  'Failed to fetch dynamically imported module',
  'error loading dynamically imported module'
];

function looksLikeStaleChunk(message) {
  if (!message || typeof message !== 'string') return false;
  return DUPLICATE_REACT_SIGNATURES.some((sig) => message.includes(sig));
}

function readState() {
  try {
    const raw = sessionStorage.getItem(RECOVERY_KEY);
    if (!raw) return { attempts: 0, firstAt: 0 };
    const parsed = JSON.parse(raw);
    // Si la ventana expiró, empezar de cero
    if (Date.now() - parsed.firstAt > ATTEMPT_WINDOW_MS) return { attempts: 0, firstAt: 0 };
    return parsed;
  } catch (_) {
    return { attempts: 0, firstAt: 0 };
  }
}

function writeState(state) {
  try {
    sessionStorage.setItem(RECOVERY_KEY, JSON.stringify(state));
  } catch (_) {}
}

let recovering = false;

export async function recoverFromStaleChunks(reason) {
  if (recovering) return;

  const state = readState();
  if (state.attempts >= MAX_ATTEMPTS) {
    console.error('[TLEC] Chunks obsoletos persistentes. Limpia la caché del navegador manualmente (Ctrl+Shift+R).');
    return;
  }

  recovering = true;
  writeState({
    attempts: state.attempts + 1,
    firstAt: state.firstAt || Date.now()
  });

  console.warn('[TLEC] Copia duplicada de React detectada (' + reason + '). Limpiando y recargando...');

  // 1. Desregistrar todos los Service Workers
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => {})));
    }
  } catch (_) {}

  // 2. Borrar todas las caches del Cache Storage
  try {
    if (window.caches && caches.keys) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => {})));
    }
  } catch (_) {}

  // 3. Recargar con cache-buster para forzar red
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('_fresh', Date.now().toString(36));
    window.location.replace(url.toString());
  } catch (_) {
    window.location.reload();
  }
}

export function installStaleChunkGuard() {
  // Limpiar el parámetro cache-buster de la URL para no ensuciarla
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('_fresh')) {
      url.searchParams.delete('_fresh');
      const qs = url.searchParams.toString();
      window.history.replaceState(null, '', url.pathname + (qs ? '?' + qs : '') + url.hash);
    }
  } catch (_) {}

  window.addEventListener('error', (event) => {
    const message = event?.error?.message || event?.message || '';
    if (looksLikeStaleChunk(message)) recoverFromStaleChunks('window.error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    const message = event?.reason?.message || '';
    if (looksLikeStaleChunk(message)) recoverFromStaleChunks('unhandledrejection');
  });
}

/** Marca que la app arrancó bien: limpia el contador de reintentos. */
export function markBootSuccess() {
  try {
    sessionStorage.removeItem(RECOVERY_KEY);
  } catch (_) {}
}