import { useState, useEffect, useCallback } from 'react';
import { getAll, put, del, clearStore } from '@/lib/offlineDb';

// Cola de impresión persistente (IndexedDB store 'print_queue').
// Sobrevive recarga/cierre de app. El operador cierra bultos lejos de la
// impresora y luego imprime todo en una sola conexión Bluetooth.
export function usePrintQueue() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const items = await getAll('print_queue');
      // Ordenar por enqueued_at ascendente (FIFO)
      items.sort((a, b) => (a.enqueued_at || '').localeCompare(b.enqueued_at || ''));
      setQueue(items);
    } catch (_) {
      setQueue([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const enqueue = useCallback(async (bulto) => {
    if (!bulto?.id) return;
    const item = {
      id: bulto.id,
      label_code: bulto.label_code || '',
      client_email: bulto.client_email || '',
      client_name: bulto.client_snapshot?.full_name || '',
      bulto_number: bulto.bulto_number || 1,
      total_bultos: bulto.total_bultos || 1,
      package_count: (bulto.package_ids?.length || bulto.package_trackings?.length || 0),
      bulto_snapshot: bulto,
      enqueued_at: new Date().toISOString(),
    };
    await put('print_queue', item);
    await reload();
  }, [reload]);

  const remove = useCallback(async (id) => {
    await del('print_queue', id);
    await reload();
  }, [reload]);

  const clear = useCallback(async () => {
    await clearStore('print_queue');
    await reload();
  }, [reload]);

  const removeMany = useCallback(async (ids) => {
    await Promise.all((ids || []).map((id) => del('print_queue', id)));
    await reload();
  }, [reload]);

  return { queue, loading, enqueue, remove, removeMany, clear, reload };
}