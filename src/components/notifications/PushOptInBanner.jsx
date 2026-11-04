import React, { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { pushSupported, subscribeToPush, requestPushPermission } from '@/lib/pushSubscribe';

const DISMISS_KEY = 'tlec-push-optin-dismissed';

export default function PushOptInBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!pushSupported()) return;
    if (Notification.permission === 'granted') {
      subscribeToPush().catch(() => {});
      return;
    }
    if (Notification.permission === 'default' && !localStorage.getItem(DISMISS_KEY)) setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => { localStorage.setItem(DISMISS_KEY, '1'); setShow(false); };
  const enable = async () => { await requestPushPermission().catch(() => false); setShow(false); };

  return (
    <div className="fixed bottom-24 left-4 right-4 z-40 mx-auto max-w-sm rounded-2xl border border-border bg-card p-4 shadow-premium sm:left-auto sm:right-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-accent p-2 text-primary"><Bell className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Activa las notificaciones</p>
          <p className="text-xs text-muted-foreground">Te avisamos al instante cuando tu carga cambie de estado.</p>
          <Button size="sm" className="mt-3" onClick={enable}>Activar</Button>
        </div>
        <button type="button" onClick={dismiss} className="text-muted-foreground" aria-label="Cerrar"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}