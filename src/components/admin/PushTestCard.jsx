import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Bell, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function PushTestCard({ user }) {
  const [working, setWorking] = useState(false);

  const handleTest = async () => {
    setWorking(true);
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        toast.error('Este navegador no soporta notificaciones push');
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Permiso de notificaciones denegado');
        return;
      }

      // Asegurar suscripción en este dispositivo
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const { data } = await base44.functions.invoke('getPushVapidKey', {});
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(data.publicKey),
        });
      }
      await base44.functions.invoke('savePushSubscription', {
        subscription: subscription.toJSON(),
      });

      // Crear notificación de prueba in-app
      await base44.entities.Notification.create({
        user_email: user.email,
        title: '🔔 Notificación de prueba',
        message: 'Si ves esto en tu teléfono, el push del administrador funciona correctamente.',
        type: 'system',
        icon: 'bell',
      });

      // Enviar el push directamente (sin depender de automatizaciones)
      const { data: pushResult } = await base44.functions.invoke('sendPushNotification', {
        userEmail: user.email,
        title: '🔔 Notificación de prueba',
        body: 'Si ves esto en tu teléfono, el push funciona correctamente.',
        url: '/AccountingDashboard',
      });

      if (pushResult?.success) {
        toast.success('Push enviado. Deberías recibirlo en tu dispositivo en unos segundos.');
      } else {
        toast.error('El push no pudo enviarse: ' + (pushResult?.error || 'error desconocido'));
      }
    } catch (error) {
      console.error('Push test error:', error);
      toast.error('Error al enviar la prueba: ' + (error.message || ''));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="p-4 md:p-6 bg-blue-50 rounded-xl border border-blue-200 space-y-3">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Bell className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800 text-lg">Notificaciones Push</h3>
          <p className="text-sm text-slate-600">Activa el push en este dispositivo y envía una notificación de prueba para verificar que funciona.</p>
        </div>
      </div>
      <Button onClick={handleTest} disabled={working} className="w-full">
        {working ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Bell className="h-4 w-4 mr-2" />}
        Enviar notificación de prueba
      </Button>
    </div>
  );
}