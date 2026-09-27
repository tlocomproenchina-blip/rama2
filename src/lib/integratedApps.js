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

// Resultado de la última prueba de ida y vuelta que ejecutó la copia.
export function testSummary(app) {
  const steps = Array.isArray(app?.test_steps) ? app.test_steps : [];
  const leftovers = Array.isArray(app?.test_leftovers) ? app.test_leftovers.filter(Boolean) : [];
  return { ran: !!app?.test_date, ok: app?.test_ok === true, date: app?.test_date || '', steps, leftovers };
}

// Una prueba pedida desde aquí queda pendiente hasta que llega su resultado.
export function testRequestState(app) {
  const requested = app?.test_requested_date || '';
  if (!requested) return { pending: false, requested: '' };
  const testDate = app?.test_date ? new Date(app.test_date).getTime() : 0;
  return { pending: !(testDate && testDate >= new Date(requested).getTime()), requested };
}

// Llamadas que TLEC CARGO rechazó: clave que no corresponde o conexión desactivada.
export function rejectedSummary(app) {
  return {
    count: Number(app?.rejected_count) || 0,
    date: app?.rejected_last_date || '',
    reason: app?.rejected_last_reason || '',
    action: app?.rejected_last_action || ''
  };
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
  const rejected = rejectedSummary(app);
  const test = testSummary(app);
  const testRequest = testRequestState(app);
  const failedStep = test.steps.find((row) => row.ok === false);

  let step;
  if (app?.active === false) {
    step = 'Activa esta conexión para que las llamadas de la copia vuelvan a ser aceptadas.';
  } else if (!app?.last_seen && rejected.count > 0) {
    step = `TLEC CARGO rechazó ${rejected.count} llamada${rejected.count === 1 ? '' : 's'} de esta copia${rejected.reason ? ` (${rejected.reason})` : ''}, así que la conexión sí llega pero no se acepta. Revisa que la clave guardada en la copia sea la vigente: puedes rotarla aquí.`;
  } else if (!app?.last_seen) {
    step = 'La copia nunca ha llamado. Guarda en ella la dirección del servicio y la clave de acceso: en su próximo ciclo de sincronización enviará su primer reporte.';
  } else if (hours > 48) {
    step = 'La copia dejó de responder. Revisa que siga publicada y que conserve guardados la dirección del servicio y la clave de acceso.';
  } else if (missing.length) {
    step = `A la copia le falta guardar: ${missing.join(', ')}.`;
  } else if (testRequest.pending) {
    step = 'Hay una prueba pedida que todavía no ha respondido; la copia la ejecutará en su próximo ciclo de sincronización (hasta 15 minutos).';
  } else if (test.ran && !test.ok && failedStep) {
    step = `La prueba de conexión falló en «${failedStep.label || failedStep.step}»: ${failedStep.detail || 'sin detalle'}`;
  } else if (test.ran && test.ok) {
    step = 'La prueba de conexión pasó completa: cliente, pre-alerta, factura y cobro se crearon, se leyeron de vuelta y se borraron.';
  } else if (pending > 0) {
    step = lastError
      ? `La copia tiene ${pending} envío${pending === 1 ? '' : 's'} pendiente${pending === 1 ? '' : 's'}. Último motivo: ${lastError}`
      : `La copia tiene ${pending} envío${pending === 1 ? '' : 's'} pendiente${pending === 1 ? '' : 's'}; se reintentan solos cada 15 minutos.`;
  } else {
    step = 'Todo en orden: la copia está enviando y no tiene pendientes.';
  }

  return {
    label: state.label,
    tone: state.tone,
    connected: state.label === 'Conectada',
    step,
    pending,
    missing,
    lastError,
    lastErrorDate,
    reportDate,
    rejected,
    test,
    testRequest
  };
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