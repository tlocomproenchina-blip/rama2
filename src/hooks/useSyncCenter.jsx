import { useEffect, useState } from 'react';
import { getState, listAcks, listQueue, startStoreForward, subscribe } from '@/lib/storeForward/engine';
import { listReviewQueue, onReviewQueueChange } from '@/lib/reviewQueue';

// Estado completo de lo guardado en este teléfono: eventos por enviar, revisiones,
// lo que requiere revisión y lo confirmado hoy por el servidor.
const lite = ({ image_base64, content_photo, damage_photos, ...rest }) => rest;

export function useSyncCenter() {
  const [data, setData] = useState({ queue: [], reviews: [], acks: [], status: getState() });

  useEffect(() => {
    startStoreForward();
    let alive = true;
    let timer = null;
    const load = async () => {
      const [queue, reviews, acks] = await Promise.all([
        listQueue(),
        listReviewQueue().catch(() => []),
        listAcks(),
      ]);
      if (!alive) return;
      setData({
        queue: queue.map(lite),
        reviews: reviews.map((r) => ({ ...lite(r), kind: 'review', sync_status: r.status, error_message: r.error, tracking: r.payload?.tracking_number })),
        acks: acks.slice(0, 40),
        status: getState(),
      });
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(load, 150); };
    load();
    const offA = subscribe(schedule);
    const offB = onReviewQueueChange(schedule);
    return () => { alive = false; clearTimeout(timer); offA(); offB(); };
  }, []);

  const startOfDay = new Date().setHours(0, 0, 0, 0);
  const all = [...data.queue, ...data.reviews];
  const conflicts = data.queue.filter((q) => q.sync_status === 'conflict');
  const pending = all.filter((q) => q.sync_status !== 'conflict');
  const syncedToday = data.acks.filter((a) => a.acked_at >= startOfDay && a.result !== 'discarded').length;

  return { ...data, pending, conflicts, syncedToday, ...data.status };
}