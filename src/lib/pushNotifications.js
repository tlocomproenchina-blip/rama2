import { base44 } from '@/api/base44Client';

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// 'granted' | 'denied' | 'default' | 'unsupported'
export function pushPermission() {
  if (!pushSupported()) return 'unsupported';
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Pide permiso y registra la suscripción push del dispositivo.
// Devuelve { ok: boolean, message: string }
export async function enablePushNotifications() {
  if (!pushSupported()) {
    return { ok: false, message: 'Este dispositivo no admite notificaciones.' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        ok: false,
        message: 'Bloqueaste las notificaciones. Actívalas en los ajustes del navegador para recibir alertas.',
      };
    }

    // Timeout de seguridad: en WebView el SW puede tardar o no activarse
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('El servicio de notificaciones no respondió. Recarga la página e inténtalo de nuevo.')),
          8000
        )
      ),
    ]);

    const { data } = await base44.functions.invoke('getPushVapidKey', {});
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey),
    });

    await base44.functions.invoke('savePushSubscription', {
      subscription: subscription.toJSON(),
    });

    return { ok: true, message: 'Notificaciones activadas correctamente' };
  } catch (error) {
    console.error('Error enabling push:', error);
    return { ok: false, message: error?.message || 'No se pudo activar las notificaciones. Inténtalo de nuevo.' };
  }
}