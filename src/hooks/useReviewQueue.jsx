import { useEffect, useState } from 'react';
import { listReviewQueue, onReviewQueueChange, processReviewQueue } from '@/lib/reviewQueue';

// Revisiones pendientes de subir. Reintenta al abrir, al volver la conexión y cada 20 s.
export default function useReviewQueue() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let alive = true;
    const refresh = () => listReviewQueue().then((list) => alive && setItems(list)).catch(() => {});
    const off = onReviewQueueChange(refresh);
    const onOnline = () => processReviewQueue();
    refresh();
    processReviewQueue();
    window.addEventListener('online', onOnline);
    const timer = setInterval(processReviewQueue, 20000);
    return () => {
      alive = false;
      off();
      window.removeEventListener('online', onOnline);
      clearInterval(timer);
    };
  }, []);

  return { items, retry: processReviewQueue };
}