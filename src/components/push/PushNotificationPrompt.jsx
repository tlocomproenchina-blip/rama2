import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Bell, X } from 'lucide-react';

const DISMISS_KEY = 'pushPromptDismissed';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function PushNotificationPrompt({ user }) {
  const [visible, setVisible] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (!user?.email) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
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
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setVisible(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const { data } = await base44.functions.invoke('getPushVapidKey', {});
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });

      await base44.functions.invoke('savePushSubscription', {
        subscription: subscription.toJSON(),
      });
      setVisible(false);
    } catch (error) {
      console.error('Error enabling push:', error);
      setVisible(false);
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
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
          <Bell className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">Activa las notificaciones</p>
          <p className="mt-0.5 text-xs text-slate-600">
            Recibe alertas en tu teléfono cuando tus paquetes sean recibidos o consolidados.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={handleEnable} disabled={subscribing} className="h-9">
              {subscribing ? 'Activando...' : 'Activar'}
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