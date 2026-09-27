export const INTEGRATED_APP_ENDPOINT = 'https://tleccargo.base44.app/functions/integratedAppApi';

export const RESOURCE_DOCS = [
  {
    key: 'clients',
    label: 'Clientes',
    detail: 'Perfil del cliente (nombre, cédula, estado, ciudad, WhatsApp, dirección y shipping mark).'
  },
  {
    key: 'prealerts',
    label: 'Pre-alertas',
    detail: 'Carga del cliente con tracking, empresa y tipo de envío, aplicando las validaciones de la maestra.'
  },
  {
    key: 'invoices',
    label: 'Facturas',
    detail: 'Emisión de la factura del cliente con sus conceptos y total.'
  },
  {
    key: 'payments',
    label: 'Cobros',
    detail: 'Abonos sobre las facturas de esa misma copia; actualizan monto pagado y estado.'
  }
];

export function buildCurlExample(key) {
  return [
    `curl -X POST ${INTEGRATED_APP_ENDPOINT} \\`,
    '  -H "Content-Type: application/json" \\',
    `  -H "x-app-key: ${key || 'TU_CLAVE'}" \\`,
    `  -d '{"resource":"prealerts","operation":"list"}'`
  ].join('\n');
}

export function appState(app) {
  if (app?.active === false) {
    return { label: 'Desactivada', tone: 'bg-slate-100 text-slate-600 border-slate-200' };
  }
  if (!app?.last_seen) {
    return { label: 'Sin conexión aún', tone: 'bg-slate-100 text-slate-600 border-slate-200' };
  }
  const hours = (Date.now() - new Date(app.last_seen).getTime()) / 3600000;
  if (hours <= 48) {
    return { label: 'Conectada', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
  return { label: 'Sin conexión', tone: 'bg-amber-50 text-amber-700 border-amber-200' };
}

export function timeAgo(dateStr) {
  if (!dateStr) return 'Sin llamadas aún';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'hace unos segundos';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days} d`;
  return new Date(dateStr).toLocaleDateString('es-VE');
}