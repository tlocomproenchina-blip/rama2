import { base44 } from '@/components/api/ApiQueueManager';
import useAdminSWR from '@/hooks/useAdminSWR';

export default function useAdminLogisticaData() {
  return useAdminSWR({
    cacheKey: 'admin_logistica_dashboard',
    ttl: 120000,
    subscribeEntities: ['Vehiculo', 'Chofer', 'Ruta', 'CargaRuta', 'SeguimientoRuta', 'LogisticsHealthReport'],
    initialData: {
      vehiculos: [],
      choferes: [],
      rutas: [],
      cargas: [],
      seguimientos: [],
      latestHealthReport: null,
    },
    fetcher: async () => {
      const [vehiculosRows, choferesRows, rutasRows, cargasRows, seguimientosRows, reportRows] = await Promise.all([
        base44.entities.Vehiculo.list('-updated_date', 200),
        base44.entities.Chofer.list('-updated_date', 200),
        base44.entities.Ruta.list('-updated_date', 200),
        base44.entities.CargaRuta.list('-updated_date', 200),
        base44.entities.SeguimientoRuta.list('-fecha_hora', 200),
        base44.entities.LogisticsHealthReport.list('-checked_at', 1),
      ]);

      return {
        vehiculos: vehiculosRows || [],
        choferes: choferesRows || [],
        rutas: rutasRows || [],
        cargas: cargasRows || [],
        seguimientos: seguimientosRows || [],
        latestHealthReport: reportRows?.[0] || null,
      };
    },
  });
}