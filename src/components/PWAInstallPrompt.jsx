import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DISMISS_KEY = 'pwa_install_prompt_dismissed_at';
const DISMISS_DAYS = 7;

function wasDismissedRecently() {
  const lastDismissed = Number(localStorage.getItem(DISMISS_KEY) || 0);
  if (!lastDismissed) return false;
  return Date.now() - lastDismissed < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const iOS = ['iPad Simulator', 'iPhone Simulator', 'iPod Simulator', 'iPad', 'iPhone', 'iPod'].includes(navigator.platform) || (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

    setIsIOS(iOS);
    setIsInstalled(standalone);

    if (standalone || wasDismissedRecently()) return;

    const iosTimer = iOS ? window.setTimeout(() => setShowPrompt(true), 3500) : null;

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      if (wasDismissedRecently()) return;
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
      localStorage.removeItem(DISMISS_KEY);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      if (iosTimer) window.clearTimeout(iosTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShowPrompt(false);
  };

  if (isInstalled || !showPrompt) return null;

  if (isIOS) {
    return (
      <div className="fixed inset-x-4 bottom-24 z-40 rounded-2xl border border-blue-200 bg-white p-4 shadow-xl lg:left-auto lg:right-6 lg:max-w-xs" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-900">Instalar app</p>
            <p className="mt-1 text-xs text-slate-600">
              Toca <Download className="inline h-3 w-3" /> Compartir y luego <strong>Añadir a pantalla de inicio</strong>.
            </p>
          </div>
          <button onClick={handleDismiss} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (!deferredPrompt) return null;

  return (
    <div className="fixed inset-x-4 bottom-24 z-40 rounded-2xl border border-blue-200 bg-white p-4 shadow-xl lg:left-auto lg:right-6 lg:max-w-xs" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">Instalar TLEC Cargo</p>
          <p className="mt-1 text-xs text-slate-600">Abre más rápido y úsala como app en tu teléfono.</p>
        </div>
        <button onClick={handleDismiss} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>
      <Button onClick={handleInstallClick} className="w-full bg-blue-600 text-sm text-white hover:bg-blue-700">
        <Download className="mr-2 h-4 w-4" />
        Instalar
      </Button>
    </div>
  );
}