import { base44 } from '@/components/api/ApiQueueManager';

const PREFETCHERS = {
  AdminOperaciones: async () => {
    await Promise.all([
      base44.entities.Package.list('-updated_date', 50),
      base44.entities.ConsolidationRequest.list('-updated_date', 50),
      base44.entities.AssistedPaymentRequest.list('-updated_date', 50),
    ]);
  },
  AdminLogistica: async () => {
    await Promise.all([
      base44.entities.Vehiculo.list('-updated_date', 50),
      base44.entities.Chofer.list('-updated_date', 50),
      base44.entities.Ruta.list('-updated_date', 50),
      base44.entities.CargaRuta.list('-updated_date', 50),
      base44.entities.SeguimientoRuta.list('-fecha_hora', 50),
    ]);
  },
  AdminVehiculos: async () => {
    await Promise.all([
      base44.entities.Vehiculo.list('-updated_date', 100),
      base44.entities.Chofer.list('-updated_date', 100),
    ]);
  },
  AdminChoferes: async () => {
    await Promise.all([
      base44.entities.Chofer.list('-updated_date', 100),
    ]);
  },
  AdminRutas: async () => {
    await Promise.all([
      base44.entities.Ruta.list('-updated_date', 100),
      base44.entities.Vehiculo.list('-updated_date', 100),
      base44.entities.Chofer.list('-updated_date', 100),
      base44.entities.CargaRuta.list('-updated_date', 150),
      base44.entities.SeguimientoRuta.list('-fecha_hora', 150),
    ]);
  },
  AdminCargaRutas: async () => {
    await Promise.all([
      base44.entities.CargaRuta.list('-updated_date', 150),
      base44.entities.Ruta.list('-updated_date', 100),
      base44.entities.Package.list('-updated_date', 150),
    ]);
  },
  AdminSeguimientoRutas: async () => {
    await Promise.all([
      base44.entities.SeguimientoRuta.list('-fecha_hora', 150),
      base44.entities.Ruta.list('-updated_date', 100),
      base44.entities.CargaRuta.list('-updated_date', 150),
    ]);
  },
  WarehouseDashboard: async () => {
    await Promise.all([
      base44.functions.invoke('getWarehouseStats', {}, { opType: 'read', dedupeKey: 'prefetch:warehouse-stats' }),
    ]);
  },
  WarehouseReceive: async () => {
    await Promise.all([
      base44.entities.Warehouse.filter({ is_active: true }, 'name', 100),
      base44.entities.WarehouseLocation.filter({ is_active: true }, 'code', 200),
    ]);
  },
  WarehouseLocations: async () => {
    await Promise.all([
      base44.entities.Warehouse.list('name', 100),
      base44.entities.WarehouseLocation.list('code', 200),
    ]);
  },
};

const prefetched = new Map();

export async function prefetchPageData(pageName) {
  if (!pageName || !PREFETCHERS[pageName]) return;
  const lastRunAt = prefetched.get(pageName) || 0;
  if (Date.now() - lastRunAt < 30000) return;
  prefetched.set(pageName, Date.now());
  await PREFETCHERS[pageName]();
}