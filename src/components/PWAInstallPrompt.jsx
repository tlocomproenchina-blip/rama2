import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Detectar iOS
    const iOS = () => {
      return [
        'iPad Simulator',
        'iPhone Simulator',
        'iPod Simulator',
        'iPad',
        'iPhone',
        'iPod'
      ].includes(navigator.platform) || (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
    };
    setIsIOS(iOS());

    // Detectar si ya está instalada
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true) {
      setIsInstalled(true);
      return;
    }

    // Evento para capturar el prompt de instalación
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    // Evento cuando la app se instala
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('Usuario aceptó la instalación');
        }
        setDeferredPrompt(null);
        setShowPrompt(false);
      });
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  if (isInstalled) {
    return null;
  }

  if (isIOS) {
    return showPrompt ? (
      <div className="fixed bottom-20 right-6 z-40 bg-white p-4 rounded-lg shadow-xl border border-blue-200 max-w-xs animate-in slide-in-from-bottom-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-sm text-slate-700 font-medium">Instalar app</p>
            <p className="text-xs text-slate-600 mt-1">
              Toca <Download className="inline h-3 w-3" /> Compartir, luego "Añadir a pantalla de inicio"
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-slate-400 hover:text-slate-600 flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    ) : null;
  }

  return showPrompt && deferredPrompt ? (
    <div className="fixed bottom-20 right-6 z-40 bg-white p-4 rounded-lg shadow-xl border border-blue-200 max-w-xs animate-in slide-in-from-bottom-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-medium text-slate-900">Instalar TLEC Cargo</p>
          <p className="text-xs text-slate-600 mt-1">Accede a tu cuenta desde cualquier lugar</p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-slate-400 hover:text-slate-600 flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <Button
        onClick={handleInstallClick}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm"
      >
        <Download className="h-4 w-4 mr-2" />
        Instalar
      </Button>
    </div>
  ) : null;
}