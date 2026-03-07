import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, BellOff, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

export default function PushNotificationManager({ user }) {
  const [permission, setPermission] = useState('default');
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isIframe, setIsIframe] = useState(false);

  useEffect(() => {
    try { setIsIframe(window.top !== window.self); } catch { setIsIframe(true); }
    refreshPermission();
    checkSubscription();
    const onVisibility = () => refreshPermission();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const checkSubscription = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();
        setSubscription(sub);
      } catch (error) {
        console.error('Error checking subscription:', error);
      }
    }
  };

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const refreshPermission = async () => {
    if (navigator?.permissions?.query) {
      try {
        const status = await navigator.permissions.query({ name: 'notifications' });
        setPermission(status.state);
      } catch (_) {
        if ('Notification' in window) setPermission(Notification.permission);
      }
    } else if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  };

  const requestPermission = async () => {
    setLoading(true);
    try {
      // Registrar service worker
      if ('serviceWorker' in navigator) {
        const scriptUrl = `/functions/sw?ts=${Date.now()}`;
        const registration = await navigator.serviceWorker.register(scriptUrl, { scope: '/' });
        await navigator.serviceWorker.ready;

        // Solicitar permiso
        const perm = await Notification.requestPermission();
        setPermission(perm);

        if (perm === 'granted') {
          // Obtener VAPID public key
          const response = await base44.functions.invoke('getPushVapidKey', {});
          const vapidPublicKey = response.data.publicKey;

          // Suscribirse
          const sub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
          });

          setSubscription(sub);

          // Guardar suscripción en backend
          await base44.functions.invoke('savePushSubscription', {
            subscription: sub.toJSON(),
            userEmail: user.email
          });

          toast.success('Notificaciones push activadas');
        } else {
          toast.error('Permiso denegado');
        }
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      toast.error('Error al activar notificaciones');
    }
    setLoading(false);
  };

  const unsubscribe = async () => {
    setLoading(true);
    try {
      if (subscription) {
        await subscription.unsubscribe();
        await base44.functions.invoke('removePushSubscription', {
          userEmail: user.email
        });
        setSubscription(null);
        toast.success('Notificaciones push desactivadas');
      }
    } catch (error) {
      console.error('Error unsubscribing:', error);
      toast.error('Error al desactivar notificaciones');
    }
    setLoading(false);
  };

  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return null;
  }

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <Smartphone className="h-5 w-5" />
          Notificaciones Push Móvil
        </CardTitle>
        <CardDescription className="text-blue-700">
          Recibe alertas instantáneas en tu dispositivo, incluso cuando la app no esté abierta
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isIframe ? (
          <div className="space-y-3">
            <Button
              onClick={requestPermission}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <Bell className="h-4 w-4 mr-2" />
              Activar Notificaciones Push
            </Button>
          </div>
        ) : subscription ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-700">
              <Bell className="h-5 w-5" />
              <span className="font-medium">Notificaciones activas</span>
            </div>
            <Button
              onClick={unsubscribe}
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              <BellOff className="h-4 w-4 mr-2" />
              Desactivar Notificaciones
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              {permission === 'denied' 
                ? '⚠️ Has bloqueado las notificaciones. Por favor, habilítalas en la configuración de tu navegador.'
                : 'Activa las notificaciones para recibir alertas instantáneas de cambios importantes.'
              }
            </p>
            {permission !== 'denied' && (
              <Button
                onClick={requestPermission}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Bell className="h-4 w-4 mr-2" />
                Activar Notificaciones Push
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}