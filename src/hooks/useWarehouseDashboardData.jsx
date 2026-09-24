import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { getStatsCache, setStatsCache } from '@/lib/offlineDb';

export default function useWarehouseDashboardData(enabled) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setRefreshing(true);
    try {
      const response = await base44.functions.invoke('getWarehouseStats', {}, { opType: 'read', dedupeKey: 'warehouse-dashboard-stats' });
      const stats = response?.data?.stats || null;
      if (stats) {
        setData(stats);
        setStale(false);
        await setStatsCache('warehouse_dashboard', stats);
      }
    } catch (e) {
      // Mantener datos del cache si falla el fetch
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [enabled]);

  // Al montar: servir cache de IndexedDB inmediatamente, luego refrescar en background
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const cached = await getStatsCache('warehouse_dashboard');
      if (cancelled) return;
      if (cached?.data) {
        setData(cached.data);
        setStale(true);
        setLoading(false);
      }
      refresh();
    })();
    return () => { cancelled = true; };
  }, [enabled, refresh]);

  // Revalidar cuando cambian entidades relevantes
  useEffect(() => {
    if (!enabled) return;
    const handler = (event) => {
      const entity = event?.detail?.entity;
      if (['Warehouse', 'WarehouseLocation', 'Package', 'ConsolidationRequest'].includes(entity)) {
        refresh();
      }
    };
    window.addEventListener('entity:event', handler);
    return () => window.removeEventListener('entity:event', handler);
  }, [enabled, refresh]);

  return { data, loading, refreshing, stale, refresh };
}