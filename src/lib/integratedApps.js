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

// Veredicto de conexión y paso a seguir, para el diagnóstico de cada copia.
export function appDiagnostic(app) {
  const state = appState(app);
  const pending = Number(app?.report_pending) || 0;
  const missing = Array.isArray(app?.report_missing) ? app.report_missing.filter(Boolean) : [];
  const lastError = String(app?.report_error || '');
  const lastErrorDate = app?.report_error_date || '';
  const reportDate = app?.report_date || '';
  const hours = app?.last_seen ? (Date.now() - new Date(app.last_seen).getTime()) / 3600000 : null;

  let step;
  if (app?.active === false) {
    step = 'Activa esta conexión para que las llamadas de la copia vuelvan a ser aceptadas.';
  } else if (!app?.last_seen) {
    step = 'La copia nunca ha llamado. Guarda en ella la dirección del servicio y la clave de acceso: en su próximo ciclo de sincronización enviará su primer reporte.';
  } else if (hours > 48) {
    step = 'La copia dejó de responder. Revisa que siga publicada y que conserve guardados la dirección del servicio y la clave de acceso.';
  } else if (missing.length) {
    step = `A la copia le falta guardar: ${missing.join(', ')}.`;
  } else if (pending > 0) {
    step = lastError
      ? `La copia tiene ${pending} envío${pending === 1 ? '' : 's'} pendiente${pending === 1 ? '' : 's'}. Último motivo: ${lastError}`
      : `La copia tiene ${pending} envío${pending === 1 ? '' : 's'} pendiente${pending === 1 ? '' : 's'}; se reintentan solos cada 15 minutos.`;
  } else {
    step = 'Todo en orden: la copia está enviando y no tiene pendientes.';
  }

  return { label: state.label, tone: state.tone, connected: state.label === 'Conectada', step, pending, missing, lastError, lastErrorDate, reportDate };
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