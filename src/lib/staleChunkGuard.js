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
  const fresh = { attempts: 0, firstAt: 0, finalCleanupDone: false };
  try {
    const raw = sessionStorage.getItem(RECOVERY_KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw);
    // Si la ventana expiró, empezar de cero
    if (Date.now() - parsed.firstAt > ATTEMPT_WINDOW_MS) return fresh;
    return { ...fresh, ...parsed };
  } catch (_) {
    return fresh;
  }
}

function writeState(state) {
  try {
    sessionStorage.setItem(RECOVERY_KEY, JSON.stringify(state));
  } catch (_) {}
}

let recovering = false;

/**
 * Limpieza profunda: desregistra Service Workers, borra todas las caches
 * del Cache Storage y limpia la metadata de optimización de Vite que quedó
 * de una sesión anterior. Es la única forma de romper el conflicto de
 * chunks (dos copias de React con hashes ?v= distintos).
 */
async function performDeepCleanup() {
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

  // 2b. Limpiar metadata de optimización de Vite guardada en sessionStorage/localStorage.
  try {
    const cleanStorage = (storage) => {
      Object.keys(storage).forEach((k) => {
        if (k.startsWith('vite-') || k.includes('vite') || k.includes('dep-optim')) {
          storage.removeItem(k);
        }
      });
    };
    cleanStorage(sessionStorage);
    cleanStorage(localStorage);
  } catch (_) {}
}

/** Recarga forzando red: fetch no-cache del HTML + replace con cache-buster. */
async function reloadWithCacheBust() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('_fresh', Date.now().toString(36));
    await fetch(url.toString(), { cache: 'no-store' }).catch(() => {});
    window.location.replace(url.toString());
  } catch (_) {
    window.location.reload();
  }
}

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
        La limpieza automática no fue suficiente. Presiona el botón para forzar
        una limpieza profunda y recarga limpia.
      </p>
      <button id="tlec-stale-refresh" style="background:#3b82f6;color:#fff;border:none;border-radius:0.75rem;padding:0.75rem 2rem;font-size:0.875rem;font-weight:600;cursor:pointer;">
        Limpiar y recargar
      </button>
      <p style="font-size:0.75rem;opacity:0.5;margin-top:1rem;">
        Si el problema persiste, limpia la caché con Ctrl+Shift+R (Cmd+Shift+R en Mac).
      </p>
    </div>`;
  document.body.appendChild(overlay);
  const btn = document.getElementById('tlec-stale-refresh');
  btn?.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Limpiando...';
    try { sessionStorage.removeItem(RECOVERY_KEY); } catch (_) {}
    await performDeepCleanup();
    await reloadWithCacheBust();
  });
}

export async function recoverFromStaleChunks(reason) {
  if (recovering) return;

  const state = readState();

  // Límite de reintentos automáticos alcanzado.
  if (state.attempts >= MAX_ATTEMPTS) {
    // Última oportunidad: una limpieza profunda final automática antes de
    // pedir intervención manual.
    if (!state.finalCleanupDone) {
      recovering = true;
      writeState({ ...state, finalCleanupDone: true });
      console.warn('[TLEC] Limpieza profunda final automática (' + reason + ').');
      await performDeepCleanup();
      await reloadWithCacheBust();
      return;
    }
    // La limpieza final tampoco resolvió el conflicto: mostrar botón manual
    // (que ahora ejecuta la misma limpieza profunda completa en un clic).
    console.error('[TLEC] Chunks obsoletos persistentes tras limpieza final.');
    showManualRefreshOverlay();
    return;
  }

  recovering = true;
  writeState({
    attempts: state.attempts + 1,
    firstAt: state.firstAt || Date.now(),
    finalCleanupDone: state.finalCleanupDone || false
  });

  console.warn('[TLEC] Copia duplicada de React detectada (' + reason + '). Limpiando y recargando...');
  await performDeepCleanup();
  await reloadWithCacheBust();
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

  // Limpiar metadata de optimización de Vite del sessionStorage/localStorage
  // incluso sin Service Worker: Vite guarda info de dependencias aquí y si
  // queda de una optimización anterior, el navegador pide chunks viejos.
  try {
    const cleanStorage = (storage) => {
      Object.keys(storage).forEach((k) => {
        if (k.startsWith('vite-') || k.includes('vite') || k.includes('dep-optim')) {
          storage.removeItem(k);
        }
      });
    };
    cleanStorage(sessionStorage);
    cleanStorage(localStorage);
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