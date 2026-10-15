import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getInstallState, promptInstall, subscribeInstallState } from '@/lib/pwaInstall';

const DISMISS_KEY = 'pwa_install_prompt_dismissed_at';
const DISMISS_DAYS = 7;

function wasDismissedRecently() {
  const lastDismissed = Number(localStorage.getItem(DISMISS_KEY) || 0);
  if (!lastDismissed) return false;
  return Date.now() - lastDismissed < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export default function PWAInstallPrompt() {
  const [installState, setInstallState] = useState(getInstallState);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => subscribeInstallState(() => setInstallState(getInstallState())), []);

  useEffect(() => {
    if (installState.installed || wasDismissedRecently()) {
      setShowPrompt(false);
      return;
    }

    if (installState.ios) {
      const iosTimer = window.setTimeout(() => setShowPrompt(true), 3500);
      return () => window.clearTimeout(iosTimer);
    }

    if (installState.canPrompt) setShowPrompt(true);
  }, [installState]);

  const handleInstallClick = async () => {
    await promptInstall();
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShowPrompt(false);
  };

  if (installState.installed || !showPrompt) return null;

  if (installState.ios) {
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

  if (!installState.canPrompt) return null;

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