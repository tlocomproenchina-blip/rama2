/**
 * Recuperación automática cuando el navegador no puede descargar el código de
 * una página (chunk caído): pasa tras publicar una versión nueva, o mientras el
 * servidor de vista previa se está reiniciando. En vez de dejar el error en
 * pantalla, se recarga la app: hasta 3 intentos por sesión y nunca dos seguidos
 * en menos de 3 segundos, para no entrar en bucle si el problema es permanente.
 */

const TRIES_KEY = 'staleChunkReloadTries';
const LAST_KEY = 'staleChunkReloadAt';
const MAX_TRIES = 3;
const MIN_GAP_MS = 3000;
const RESET_AFTER_MS = 20000;

export const isStaleChunkError = (message = '') =>
  /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|failed to load module script|chunkloaderror|loading chunk \d+ failed/i.test(String(message));

export function reloadForStaleChunk() {
  try {
    const tries = Number(sessionStorage.getItem(TRIES_KEY) || '0');
    const last = Number(sessionStorage.getItem(LAST_KEY) || '0');
    if (tries >= MAX_TRIES) return false;
    if (Date.now() - last < MIN_GAP_MS) return false;
    sessionStorage.setItem(TRIES_KEY, String(tries + 1));
    sessionStorage.setItem(LAST_KEY, String(Date.now()));
  } catch (_) {
    // Sin sessionStorage no se pueden contar los intentos: mejor no recargar.
    return false;
  }
  window.location.reload();
  return true;
}

// Si la app lleva un rato funcionando bien, los intentos vuelven a cero: así un
// chunk caído más adelante en la misma sesión también se puede recuperar.
export function resetStaleChunkAttempts(delayMs = RESET_AFTER_MS) {
  return setTimeout(() => {
    try {
      sessionStorage.removeItem(TRIES_KEY);
      sessionStorage.removeItem(LAST_KEY);
    } catch (_) {}
  }, delayMs);
}