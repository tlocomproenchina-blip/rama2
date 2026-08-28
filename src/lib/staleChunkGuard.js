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
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 180000; // reintentos válidos dentro de 3 minutos

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

function showManualRefreshOverlay() {
  if (document.getElementById('tlec-stale-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'tlec-stale-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.92);font-family:system-ui,sans-serif;padding:1.5rem;text-align:center;';
  overlay.innerHTML = `
    <div style="max-width:420px;color:#fff;">
      <div style="font-size:2.5rem;margin-bottom:0.5rem;">⚠️</div>
      <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:0.5rem;">Caché del navegador desactualizada</h2>
      <p style="font-size:0.875rem;opacity:0.8;margin-bottom:1.5rem;line-height:1.5;">
        Tu navegador tiene archivos JavaScript antiguos guardados en caché.
        Presiona el botón para forzar una recarga limpia.
      </p>
      <button id="tlec-stale-refresh" style="background:#3b82f6;color:#fff;border:none;border-radius:0.75rem;padding:0.75rem 2rem;font-size:0.875rem;font-weight:600;cursor:pointer;">
        Recargar limpio
      </button>
      <p style="font-size:0.75rem;opacity:0.5;margin-top:1rem;">
        Si el problema persiste, limpia la caché con Ctrl+Shift+R (Cmd+Shift+R en Mac).
      </p>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('tlec-stale-refresh')?.addEventListener('click', () => {
    try { sessionStorage.removeItem(RECOVERY_KEY); } catch (_) {}
    // fetch the page with no-cache, then reload to bust HTTP cache
    fetch(window.location.href, { cache: 'no-store' }).finally(() => {
      window.location.reload();
    });
  });
}

export async function recoverFromStaleChunks(reason) {
  if (recovering) return;

  const state = readState();
  if (state.attempts >= MAX_ATTEMPTS) {
    console.error('[TLEC] Chunks obsoletos persistentes. Limpia la caché del navegador manualmente (Ctrl+Shift+R).');
    showManualRefreshOverlay();
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

  // 3. Recargar forzando red: fetch no-cache del HTML para invalidar la
  //    caché HTTP del navegador, luego reload para que los módulos se
  //    re-descarguen desde el servidor (no desde disk cache).
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('_fresh', Date.now().toString(36));
    await fetch(url.toString(), { cache: 'no-store' }).catch(() => {});
    window.location.replace(url.toString());
  } catch (_) {
    window.location.reload();
  }
}

export async function installStaleChunkGuard() {
  // Limpiar el parámetro cache-buster de la URL para no ensuciarla
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('_fresh')) {
      url.searchParams.delete('_fresh');
      const qs = url.searchParams.toString();
      window.history.replaceState(null, '', url.pathname + (qs ? '?' + qs : '') + url.hash);
    }
  } catch (_) {}

  // PRE-CHEQUEO CRÍTICO: si un Service Worker de una visita anterior está
  // controlando esta página, puede estar sirviendo JS cacheado de una
  // optimización de Vite anterior (chunks con ?v= viejos). Esto provoca
  // dos copias de React ("Cannot read properties of null (reading 'useState')").
  // Debemos limpiarlo ANTES de que la app se renderice, no después del error.
  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => {})));
      if (window.caches && caches.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k).catch(() => {})));
      }
      // Recargar inmediatamente para que la próxima carga sea sin SW
      const url = new URL(window.location.href);
      url.searchParams.set('_fresh', Date.now().toString(36));
      window.location.replace(url.toString());
      return; // La página se va a recargar, no continuar
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

  // React en modo desarrollo captura los errores de render y los reporta vía
  // console.error (no llegan a window.error). createRoot().render() es asíncrono,
  // así que el try/catch de main.jsx no los atrapa. Interceptamos console.error
  // para detectar la firma de doble React y disparar la recuperación.
  try {
    const originalConsoleError = console.error.bind(console);
    console.error = function (...args) {
      try {
        const text = args.map((a) => (a && typeof a === 'object' ? a?.message || '' : String(a))).join(' ');
        if (looksLikeStaleChunk(text)) {
          recoverFromStaleChunks('console.error: ' + text.slice(0, 120));
        }
      } catch (_) {}
      return originalConsoleError(...args);
    };
  } catch (_) {}
}

/** Marca que la app arrancó bien: limpia el contador de reintentos. */
export function markBootSuccess() {
  try {
    sessionStorage.removeItem(RECOVERY_KEY);
  } catch (_) {}
}