// Estado compartido de instalación de la app (PWA).
// El evento beforeinstallprompt se captura una sola vez aquí, para que la
// instalación se pueda iniciar tanto desde el aviso flotante como desde el perfil.

let deferredPrompt = null;
let installed = false;
let initialized = false;
const listeners = new Set();

function emit() {
  listeners.forEach((cb) => {
    try { cb(); } catch (_) {}
  });
}

export function isStandalone() {
  try {
    return (
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true
    );
  } catch (_) {
    return false;
  }
}

export function isIOSDevice() {
  try {
    const platforms = ['iPad Simulator', 'iPhone Simulator', 'iPod Simulator', 'iPad', 'iPhone', 'iPod'];
    return platforms.includes(navigator.platform) || (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
  } catch (_) {
    return false;
  }
}

export function initInstallCapture() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  installed = isStandalone();

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    emit();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installed = true;
    emit();
  });
}

export function getInstallState() {
  return {
    installed: installed || isStandalone(),
    ios: isIOSDevice(),
    canPrompt: !!deferredPrompt,
  };
}

export function subscribeInstallState(cb) {
  initInstallCapture();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// Devuelve: 'installed' | 'accepted' | 'dismissed' | 'unavailable' | 'error'
export async function promptInstall() {
  if (installed || isStandalone()) return 'installed';
  if (!deferredPrompt) return 'unavailable';
  try {
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    emit();
    return choice?.outcome === 'accepted' ? 'accepted' : 'dismissed';
  } catch (_) {
    return 'error';
  }
}

initInstallCapture();