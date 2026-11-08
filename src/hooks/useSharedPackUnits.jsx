import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { loadOpenUnits, sameClient } from '@/lib/packUnits';
import {
  applyRemoteUnit, fetchOpenShared, flushQueue, isSharedUnit, pendingCount, queueUnitChange,
} from '@/lib/sharedUnits';

// Guarda en línea las cajas y bultos que el operador está armando: envía cada cambio,
// recibe los suyos hechos desde otro dispositivo y reintenta lo pendiente al reconectar.
// Las unidades abiertas de otros operadores no entran en su mesa de trabajo.
export default function useSharedPackUnits({ owner, onRemoteChange, onDuplicate }) {
  const [pending, setPending] = useState(pendingCount());
  const [syncing, setSyncing] = useState(false);
  const [lastShared, setLastShared] = useState(null);
  const onRemoteRef = useRef(onRemoteChange);
  onRemoteRef.current = onRemoteChange;
  const onDuplicateRef = useRef(onDuplicate);
  onDuplicateRef.current = onDuplicate;
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
        const { changed, rejected } = await flushQueue(deviceId);
        setLastShared(new Date().toISOString());
        if (rejected.length) onDuplicateRef.current?.(rejected);
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

  // Trae las unidades abiertas del operador y sube las suyas que falten en el servidor.
  const pullAll = useCallback(async () => {
    if (!owner) return;
    try {
      const records = await fetchOpenShared(owner);
      for (const record of records) await applyRemoteUnit(record).catch(() => null);
      const known = new Set(records.map((r) => r.unit_id));
      const local = await loadOpenUnits(owner);
      for (const unit of local) {
        if (!known.has(unit.id)) queueUnitChange(null, unit);
      }
      setLastShared(new Date().toISOString());
    } catch (_) {}
    setPending(pendingCount());
    flush();
  }, [flush, owner]);

  useEffect(() => {
    const unsubscribe = base44.entities.OpenPackUnit.subscribe((event) => {
      const data = event?.data;
      if (!data || event.type === 'delete') return;
      if (!sameClient(data.created_by_email, owner)) return;
      applyRemote(data);
    });
    const onOnline = () => pullAll();
    window.addEventListener('online', onOnline);
    const timer = setInterval(flush, 20000);
    return () => {
      unsubscribe?.();
      window.removeEventListener('online', onOnline);
      clearInterval(timer);
    };
  }, [applyRemote, flush, pullAll, owner]);

  return { pending, syncing, lastShared, pushChange, pushStatus, pullAll };
}