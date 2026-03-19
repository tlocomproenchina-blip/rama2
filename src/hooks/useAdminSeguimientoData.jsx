import { base44 } from '@/components/api/ApiQueueManager';
import useAdminSWR from '@/hooks/useAdminSWR';

export default function useAdminSeguimientoData() {
  return useAdminSWR({
    cacheKey: 'admin_seguimiento_dashboard',
    ttl: 120000,
    subscribeEntities: ['Package', 'Ruta', 'SeguimientoRuta'],
    initialData: {
      packages: [],
      routes: [],
      trackingEvents: [],
    },
    fetcher: async () => {
      const [packageRows, routeRows, trackingRows] = await Promise.all([
        base44.entities.Package.list('-updated_date', 300),
        base44.entities.Ruta.list('-updated_date', 300),
        base44.entities.SeguimientoRuta.list('-fecha_hora', 300),
      ]);

      return {
        packages: packageRows || [],
        routes: routeRows || [],
        trackingEvents: trackingRows || [],
      };
    },
  });
}