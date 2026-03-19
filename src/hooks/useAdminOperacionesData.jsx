import { base44 } from '@/components/api/ApiQueueManager';
import useAdminSWR from '@/hooks/useAdminSWR';

export default function useAdminOperacionesData() {
  return useAdminSWR({
    cacheKey: 'admin_operaciones_dashboard',
    ttl: 120000,
    subscribeEntities: ['Package', 'ConsolidationRequest', 'AssistedPaymentRequest'],
    initialData: {
      packages: [],
      requests: [],
      assistedPayments: [],
    },
    fetcher: async () => {
      const [packageRows, requestRows, paymentRows] = await Promise.all([
        base44.entities.Package.list('-updated_date', 300),
        base44.entities.ConsolidationRequest.list('-updated_date', 300),
        base44.entities.AssistedPaymentRequest.list('-updated_date', 300),
      ]);

      return {
        packages: packageRows || [],
        requests: requestRows || [],
        assistedPayments: paymentRows || [],
      };
    },
  });
}