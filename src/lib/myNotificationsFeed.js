import { base44 } from '@/components/api/ApiQueueManager';

// Una sola consulta compartida de las notificaciones del usuario: la campana y
// los puntos rojos del menú la reutilizan en vez de pedirla cada uno por su lado.
const FRESH_MS = 5000;
let inflight = null;
let last = { at: 0, data: null };

export async function fetchMyNotifications({ force = false } = {}) {
  if (!force && last.data && Date.now() - last.at < FRESH_MS) return last.data;
  if (inflight) return inflight;
  inflight = base44.functions.invoke('getMyNotifications', {})
    .then((res) => {
      const list = res?.data?.notifications || [];
      last = { at: Date.now(), data: list };
      return list;
    })
    .finally(() => { inflight = null; });
  return inflight;
}