import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { loadOpenUnits } from '@/lib/packUnits';
import {
  applyRemoteUnit, fetchOpenShared, flushQueue, isSharedUnit, pendingCount, queueUnitChange,
} from '@/lib/sharedUnits';

// Comparte las cajas y bultos en armado con el resto del equipo: envía cada cambio,
// recibe en tiempo real los de los demás y reintenta lo pendiente al reconectar.
export default function useSharedPackUnits({ onRemoteChange }) {
  const [pending, setPending] = useState(pendingCount());
  const [syncing, setSyncing] = useState(false);
  const [lastShared, setLastShared] = useState(null);
  const onRemoteRef = useRef(onRemoteChange);
  onRemoteRef.current = onRemoteChange;
  const flushingRef = useRef(false);
  const againRef = useRef(false);

  const deviceId = useMemo(() => {
    try { return localStorage.getItem('tlec_warehouse_device_id') || ''; } catch (_) { return ''; }
  }, []);

  const flush = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (flushingRef.current) { againRef.current = true; return; }
    flushingRef.current = true;
    setSyncing(true);
    try {
      do {
        againRef.current = false;
        if (!pendingCount()) break;
        const changed = await flushQueue(deviceId);
        setLastShared(new Date().toISOString());
        if (changed) onRemoteRef.current?.();
      } while (againRef.current);
    } catch (_) {
      // Sin conexión o error temporal: queda pendiente y se reintenta.
    } finally {
      flushingRef.current = false;
      setSyncing(false);
      setPending(pendingCount());
    }
  }, [deviceId]);

  const pushChange = useCallback((prev, next) => {
    if (!next || next.status !== 'activo' || next.closed_at) return;
    if (queueUnitChange(prev, next)) { setPending(pendingCount()); flush(); }
  }, [flush]);

  const pushStatus = useCallback((unit, status) => {
    if (!isSharedUnit(unit)) return;
    if (queueUnitChange(unit, unit, status)) { setPending(pendingCount()); flush(); }
  }, [flush]);

  const applyRemote = useCallback(async (record) => {
    const result = await applyRemoteUnit(record).catch(() => null);
    if (!result) return;
    if (result.needsPush) { setPending(pendingCount()); flush(); }
    onRemoteRef.current?.();
  }, [flush]);

  // Trae lo que el equipo tiene abierto y sube lo que este dispositivo tenga sin compartir.
  const pullAll = useCallback(async () => {
    try {
      const records = await fetchOpenShared();
      for (const record of records) await applyRemoteUnit(record).catch(() => null);
      const known = new Set(records.map((r) => r.unit_id));
      const local = await loadOpenUnits();
      for (const unit of local) {
        if (!known.has(unit.id)) queueUnitChange(null, unit);
      }
      setLastShared(new Date().toISOString());
    } catch (_) {}
    setPending(pendingCount());
    flush();
  }, [flush]);

  useEffect(() => {
    const unsubscribe = base44.entities.OpenPackUnit.subscribe((event) => {
      if (event?.data && event.type !== 'delete') applyRemote(event.data);
    });
    const onOnline = () => pullAll();
    window.addEventListener('online', onOnline);
    const timer = setInterval(flush, 20000);
    return () => {
      unsubscribe?.();
      window.removeEventListener('online', onOnline);
      clearInterval(timer);
    };
  }, [applyRemote, flush, pullAll]);

  return { pending, syncing, lastShared, pushChange, pushStatus, pullAll };
}