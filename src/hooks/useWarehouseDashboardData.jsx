import { base44 } from '@/components/api/ApiQueueManager';
import useAdminSWR from '@/hooks/useAdminSWR';

export default function useWarehouseDashboardData(enabled) {
  return useAdminSWR({
    cacheKey: enabled ? 'warehouse_dashboard_stats' : 'warehouse_dashboard_disabled',
    ttl: 120000,
    subscribeEntities: ['Warehouse', 'WarehouseLocation', 'Package', 'ConsolidationRequest'],
    initialData: null,
    deps: [enabled],
    fetcher: async () => {
      if (!enabled) return null;
      const response = await base44.functions.invoke('getWarehouseStats', {}, { opType: 'read', dedupeKey: 'warehouse-dashboard-stats' });
      return response?.data?.stats || null;
    },
  });
}