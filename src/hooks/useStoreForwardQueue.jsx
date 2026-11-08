import { useEffect, useRef, useState } from 'react';
import { getState, listQueue, startStoreForward, subscribe } from '@/lib/storeForward/engine';

// Eventos de la cola Store and Forward que cumplen `match`, más el estado de envío.
const lite = ({ image_base64, ...rest }) => rest;

export function useStoreForwardQueue(match) {
  const matchRef = useRef(match);
  matchRef.current = match;
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState(getState());

  useEffect(() => {
    startStoreForward();
    let alive = true;
    let timer = null;
    const load = async () => {
      const queue = await listQueue();
      if (!alive) return;
      setItems(queue.filter((i) => matchRef.current(i)).map(lite));
      setStatus(getState());
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(load, 120); };
    load();
    const unsubscribe = subscribe(schedule);
    return () => { alive = false; clearTimeout(timer); unsubscribe(); };
  }, []);

  return { items, isSyncing: status.syncing, isOnline: status.online, persisted: status.persisted };
}