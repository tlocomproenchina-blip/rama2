import { base44 } from '@/api/base44Client';

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const toUint8 = (base64) => {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

// Registra el service worker, crea (o reutiliza) la suscripción y la guarda en el usuario.
export async function subscribeToPush() {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const res = await base44.functions.invoke('getPushVapidKey', {});
    const key = res?.data?.publicKey;
    if (!key) return false;
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toUint8(key) });
  }
  await base44.functions.invoke('savePushSubscription', { subscription: sub.toJSON() });
  return true;
}

export async function requestPushPermission() {
  if (!pushSupported()) return false;
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return false;
  return subscribeToPush();
}