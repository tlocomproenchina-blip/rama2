import { base44 } from '@/components/api/ApiQueueManager';

const BG_REFRESH_MS = 120000;
const PREFETCH_COOLDOWN_MS = 30000;
const MODULES_TO_KEEP_WARM = [
  'AccountingDashboard',
  'AdminDashboard',
  'AdminSupport',
  'AdminConsolidate',
  'AdminPayments',
  'AdminInvoices',
  'AdminPackages',
  'AdminClients'
];

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
  AccountingDashboard: async () => {
    await Promise.all([
      base44.entities.Invoice.list('-updated_date', 80),
      base44.entities.AccountsPayable.list('-updated_date', 80),
    ]);
  },
  AdminDashboard: async () => {
    await Promise.all([
      base44.entities.Package.list('-created_date', 20),
      base44.entities.Consolidation.list('-created_date', 20),
      base44.entities.Invoice.list('-created_date', 20),
      base44.entities.SupportTicket.list('-created_date', 40),
    ]);
  },
  AdminSupport: async () => {
    await Promise.all([
      base44.entities.SupportTicket.list('-created_date', 40),
      base44.entities.User.filter({ role: 'user' }, '-created_date', 80),
    ]);
  },
  AdminConsolidate: async () => {
    await Promise.all([
      base44.entities.ConsolidationRequest.filter({ status: 'pendiente' }, '-created_date', 40),
      base44.entities.Package.filter({ status: 'pre_alerta' }, '-created_date', 80),
      base44.entities.Package.filter({ status: 'recibido' }, '-created_date', 80),
    ]);
  },
  AdminPayments: async () => {
    await Promise.all([
      base44.entities.Consolidation.list('-created_date', 40),
      base44.entities.User.list('-created_date', 120),
    ]);
  },
  AdminInvoices: async () => {
    await Promise.all([
      base44.entities.Invoice.list('-invoice_date', 40),
      base44.entities.Consolidation.list('-created_date', 80),
    ]);
  },
  AdminPackages: async () => {
    await Promise.all([
      base44.entities.Package.list('-created_date', 40),
      base44.entities.User.list('-created_date', 120),
    ]);
  },
  AdminClients: async () => {
    await Promise.all([
      base44.functions.invoke('listClientsForSupport', {}, { opType: 'read', dedupeKey: 'prefetch:clients-support' }),
      base44.entities.Package.list('-updated_date', 120),
    ]);
  },
};

const prefetched = new Map();
let keepWarmTimer = null;
let warming = false;

export async function prefetchPageData(pageName, { force = false } = {}) {
  if (!pageName || !PREFETCHERS[pageName]) return;
  const user = await base44.auth.me();
  if (user?.role !== 'admin') return;
  const lastRunAt = prefetched.get(pageName) || 0;
  if (!force && Date.now() - lastRunAt < PREFETCH_COOLDOWN_MS) return;
  prefetched.set(pageName, Date.now());
  await PREFETCHERS[pageName]();
}

export async function prefetchModuleGroup(pageNames = [], options = {}) {
  await Promise.all((pageNames || []).filter((name) => PREFETCHERS[name]).map((name) => prefetchPageData(name, options)));
}

export function startBackgroundModulePreload(pageNames = MODULES_TO_KEEP_WARM) {
  if (keepWarmTimer) return;

  const run = async () => {
    if (warming) return;
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return;
    warming = true;
    try {
      await prefetchModuleGroup(pageNames, { force: true });
    } finally {
      warming = false;
    }
  };

  run();
  keepWarmTimer = window.setInterval(run, BG_REFRESH_MS);
}

export function stopBackgroundModulePreload() {
  if (keepWarmTimer) {
    window.clearInterval(keepWarmTimer);
    keepWarmTimer = null;
  }
}