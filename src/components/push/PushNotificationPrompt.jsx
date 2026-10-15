import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { enablePushNotifications, pushSupported } from '@/lib/pushNotifications';

const DISMISS_KEY = 'pushPromptDismissed';

export default function PushNotificationPrompt({ user }) {
  const [visible, setVisible] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!user?.email) return;
    if (!pushSupported()) return;
    if (Notification.permission !== 'default') return;

    try {
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY));
      if (dismissedAt && Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
    } catch (_) {}

    const timer = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(timer);
  }, [user?.email]);

  const handleEnable = async () => {
    setSubscribing(true);
    setErrorMsg('');
    try {
      const result = await enablePushNotifications();
      if (result.ok) {
        toast.success(result.message);
        setVisible(false);
      } else {
        setErrorMsg(result.message);
      }
    } finally {
      setSubscribing(false);
    }
  };

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (_) {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl border border-border/70 bg-white p-4 shadow-premium lg:left-auto lg:right-6">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${errorMsg ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
          {errorMsg ? <AlertCircle className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">
            {errorMsg ? 'No se pudieron activar' : 'Activa las notificaciones'}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            {errorMsg || 'Recibe alertas en tu teléfono cuando tus paquetes sean recibidos o consolidados.'}
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={handleEnable} disabled={subscribing} className="h-9">
              {subscribing ? 'Activando...' : errorMsg ? 'Reintentar' : 'Activar'}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss} className="h-9 text-slate-500">
              Ahora no
            </Button>
          </div>
        </div>
        <button onClick={handleDismiss} className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}