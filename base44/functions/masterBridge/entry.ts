import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { secrets } from 'base44:runtime';
import { testClientEmail, testClientMark } from '../../shared/integratedApps.ts';

// Puente de la copia hacia TLEC CARGO.
// La clave de la copia vive en el servidor de la copia: el navegador nunca la ve.
// Todo lo que sale de aquí queda registrado en la cola MasterSyncOutbox, que se
// reintenta sola cuando la maestra no responde.

const DEFAULT_ENDPOINT = 'https://tleccargo.base44.app/functions/integratedAppApi';
const URL_SECRETS = ['Dirección_del_servicio', 'Direccion_del_servicio', 'DIRECCION_DEL_SERVICIO', 'MASTER_API_URL', 'TLEC_MASTER_URL'];
const KEY_SECRETS = ['Clave_de_acceso', 'CLAVE_DE_ACCESO', 'MASTER_APP_KEY', 'TLEC_APP_KEY'];
const TIMEOUT_MS = 15000;
const RETRY_LIMIT = 20;
const REPORT_LIMIT = 200;
const SCAN_LIMIT = 10;
const SCAN_WINDOW_MS = 24 * 60 * 60 * 1000;
const OUTBOX = 'MasterSyncOutbox';
const TEST_KEY = 'connection_test';
const TEST_INTERVAL_MS = 22 * 60 * 60 * 1000;
const TEST_AMOUNT = 0.01;

function readSecret(names) {
  for (const name of names) {
    try {
      const value = secrets.get(name);
      if (value && String(value).trim()) return String(value).trim();
    } catch (_) {
      // esa variable no existe con ese nombre: se prueba la siguiente variante
    }
  }
  return '';
}

function masterConfig() {
  const url = readSecret(URL_SECRETS);
  const key = readSecret(KEY_SECRETS);
  const missing = [];
  if (!url) missing.push('Dirección_del_servicio');
  if (!key) missing.push('Clave_de_acceso');
  return { url, key, missing, configured: missing.length === 0 };
}

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

function clientPayload(client) {
  return {
    resource: 'clients',
    operation: 'create',
    email: String(client.email || '').trim().toLowerCase(),
    first_name: client.first_name || '',
    last_name: client.last_name || '',
    cedula: client.cedula || '',
    state: client.state || '',
    city: client.city || '',
    whatsapp: client.whatsapp || '',
    whatsapp_normalized: digits(client.whatsapp),
    address: client.address || '',
    shipping_mark: client.shipping_mark || ''
  };
}

function prealertPayload(pkg) {
  return {
    resource: 'prealerts',
    operation: 'create',
    client_email: String(pkg.client_email || '').trim().toLowerCase(),
    tracking_number: String(pkg.tracking_number || '').trim(),
    description: pkg.description || '',
    shipping_type: pkg.shipping_type === 'maritimo' ? 'maritimo' : 'aereo',
    risk_category: pkg.risk_category === 'alto_riesgo' ? 'alto_riesgo' : 'general',
    package_count: Number(pkg.package_count) || 1,
    shipping_company: pkg.shipping_company || '',
    shipping_address: pkg.shipping_address || '',
    has_insurance: !!pkg.has_insurance,
    fob_value: Number(pkg.fob_value) || 0,
    product_image_url: pkg.product_image_url || '',
    invoice_url: pkg.invoice_url || '',
    label_code: pkg.label_code || '',
    seller_delivery_date: pkg.seller_delivery_date || ''
  };
}

function responseNote(data) {
  const action = data?.action;
  if (action === 'created') return 'Registrado en TLEC CARGO';
  if (action === 'updated') return 'Actualizado en TLEC CARGO';
  if (action === 'linked') return 'Cliente vinculado en TLEC CARGO';
  if (action === 'claimed_orphan') return 'Paquete huérfano reclamado en TLEC CARGO';
  return 'Aceptado por TLEC CARGO';
}

async function callMaster(cfg, body) {
  try {
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-key': cfg.key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_) {
      data = { raw: String(text || '').slice(0, 300) };
    }
    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    const timeout = error?.name === 'TimeoutError';
    return {
      ok: false,
      status: 0,
      data: null,
      error: timeout ? 'TLEC CARGO no respondió a tiempo' : (error?.message || 'No se pudo conectar con TLEC CARGO')
    };
  }
}

async function findRow(svc, idempotencyKey) {
  const rows = await svc.entities[OUTBOX].filter({ idempotency_key: idempotencyKey }, '-created_date', 1);
  return rows?.[0] || null;
}

// Crea o reactiva la fila de la cola. Devuelve null cuando ya viajó antes.
async function enqueue(svc, data) {
  const row = await findRow(svc, data.idempotency_key);
  if (row && row.status === 'enviado') return null;
  if (row) {
    return await svc.entities[OUTBOX].update(row.id, {
      payload: data.payload,
      label: data.label,
      record_id: data.record_id,
      status: 'pendiente'
    });
  }
  return await svc.entities[OUTBOX].create({
    resource: data.resource,
    record_id: data.record_id,
    idempotency_key: data.idempotency_key,
    label: data.label,
    payload: data.payload,
    status: 'pendiente',
    attempts: 0
  });
}

async function attempt(svc, cfg, row) {
  const result = await callMaster(cfg, row.payload);
  const attempts = (Number(row.attempts) || 0) + 1;
  const now = new Date().toISOString();

  if (result.ok) {
    const note = responseNote(result.data);
    await svc.entities[OUTBOX].update(row.id, {
      status: 'enviado',
      attempts,
      last_attempt_date: now,
      sent_date: now,
      last_error: '',
      master_response: note
    });
    return { ok: true, message: note };
  }

  const message = String(result.data?.error?.message || result.error || `Error ${result.status}`).slice(0, 400);

  // 409: el registro ya existe en la maestra. Se reconcilia y no se reintenta en bucle.
  if (result.status === 409) {
    await svc.entities[OUTBOX].update(row.id, {
      status: 'enviado',
      attempts,
      last_attempt_date: now,
      sent_date: now,
      last_error: '',
      master_response: message
    });
    return { ok: true, message };
  }

  await svc.entities[OUTBOX].update(row.id, {
    status: 'error',
    attempts,
    last_attempt_date: now,
    last_error: message
  });
  return { ok: false, message, code: result.data?.error?.code || '' };
}

async function syncClient(svc, cfg, email) {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean) return { ok: false, message: 'Falta el email del cliente' };

  const rows = await svc.entities.User.filter({ email: clean }, '-created_date', 1);
  const client = rows?.[0];
  if (!client) return { ok: false, message: `No existe el cliente ${clean} en esta app` };
  if (client.role && client.role !== 'user') return { ok: true, already: true, message: 'Es un usuario interno, no se envía' };

  const row = await enqueue(svc, {
    resource: 'clients',
    record_id: client.id,
    idempotency_key: `clients:${clean}`,
    label: client.full_name || clean,
    payload: clientPayload(client)
  });
  if (!row) return { ok: true, already: true, message: 'El cliente ya fue enviado' };
  if (!cfg.configured) return { ok: false, message: 'Falta configurar la conexión con TLEC CARGO' };
  return await attempt(svc, cfg, row);
}

async function syncPrealert(svc, cfg, packageId) {
  const id = String(packageId || '').trim();
  if (!id) return { ok: false, message: 'Falta el id del paquete' };

  let pkg = null;
  try {
    pkg = await svc.entities.Package.get(id);
  } catch (_) {
    pkg = null;
  }
  if (!pkg) return { ok: false, message: 'No existe ese paquete en esta app' };
  if (!pkg.client_email) return { ok: false, message: 'El paquete no tiene cliente asignado' };
  if (!pkg.tracking_number) return { ok: false, message: 'El paquete no tiene número de tracking' };

  // El cliente debe existir en la maestra antes que su pre-alerta.
  const clientResult = await syncClient(svc, cfg, pkg.client_email);

  const tracking = String(pkg.tracking_number).trim();
  const row = await enqueue(svc, {
    resource: 'prealerts',
    record_id: pkg.id,
    idempotency_key: `prealerts:${tracking}`,
    label: tracking,
    payload: prealertPayload(pkg)
  });
  if (!row) return { ok: true, already: true, message: 'La pre-alerta ya fue enviada', client: clientResult };
  if (!cfg.configured) return { ok: false, message: 'Falta configurar la conexión con TLEC CARGO', client: clientResult };

  const result = await attempt(svc, cfg, row);
  return { ...result, client: clientResult };
}

function failureText(result) {
  const message = result?.data?.error?.message || result?.error || `Error ${result?.status || 'desconocido'}`;
  return String(message).slice(0, 300);
}

// Prueba de ida y vuelta completa: alta, lectura de vuelta y borrado de datos
// marcados como prueba. Corre aquí porque la copia es la única que tiene la clave.
async function runConnectionTest(cfg, slug) {
  const email = testClientEmail(slug);
  const mark = testClientMark(slug);
  const stamp = Date.now().toString(36).toUpperCase();
  const invoiceNumber = `PRUEBA-${slug.toUpperCase()}-${stamp}`;
  const steps = [];
  const leftovers = [];
  let invoiceId = '';
  let paymentId = '';

  // 1. Cliente de prueba: alta y lectura de vuelta.
  const created = await callMaster(cfg, {
    resource: 'clients',
    operation: 'create',
    email,
    first_name: 'Cliente de prueba',
    last_name: 'Conexión',
    shipping_mark: mark
  });
  if (!created.ok) {
    steps.push({ step: 'cliente', label: 'Cliente de prueba', ok: false, detail: failureText(created) });
  } else {
    const readBack = await callMaster(cfg, { resource: 'clients', operation: 'get', email });
    const found = readBack.ok && String(readBack.data?.client?.email || '').toLowerCase() === email;
    steps.push({
      step: 'cliente',
      label: 'Cliente de prueba',
      ok: found,
      detail: found ? 'Se creó y se leyó de vuelta correctamente' : `No se pudo leer de vuelta: ${failureText(readBack)}`
    });
  }

  // 2. Pre-alerta de prueba: se valida sin guardarla, porque guardarla
  //    dispararía avisos y correos a operaciones y al cliente.
  const prealert = await callMaster(cfg, {
    resource: 'prealerts',
    operation: 'validate',
    client_email: email,
    tracking_number: `PRUEBA-${stamp}`,
    description: 'Validación de la prueba de conexión',
    shipping_type: 'aereo',
    risk_category: 'general'
  });
  steps.push({
    step: 'prealerta',
    label: 'Pre-alerta de prueba',
    ok: prealert.ok,
    detail: prealert.ok ? `Validada con el shipping mark ${mark}` : failureText(prealert)
  });

  // 3. Factura y cobro de prueba.
  const invoice = await callMaster(cfg, {
    resource: 'invoices',
    operation: 'create',
    client_email: email,
    invoice_number: invoiceNumber,
    total: TEST_AMOUNT,
    notes: 'PRUEBA DE CONEXIÓN — se elimina automáticamente'
  });
  if (invoice.ok) invoiceId = String(invoice.data?.record?.id || '');
  if (!invoice.ok) {
    steps.push({ step: 'factura', label: 'Factura y cobro de prueba', ok: false, detail: failureText(invoice) });
  } else {
    const payment = await callMaster(cfg, {
      resource: 'payments',
      operation: 'create',
      invoice_id: invoiceId,
      amount: TEST_AMOUNT,
      method: 'otro',
      reference: `PRUEBA-${stamp}`,
      description: 'Cobro de la prueba de conexión'
    });
    if (payment.ok) paymentId = String(payment.data?.record?.id || '');
    steps.push({
      step: 'factura',
      label: 'Factura y cobro de prueba',
      ok: payment.ok,
      detail: payment.ok ? `Factura ${invoiceNumber} con su cobro registrados` : failureText(payment)
    });
  }

  // 4. Borrado de todo lo creado, en orden inverso.
  if (paymentId) {
    const removed = await callMaster(cfg, { resource: 'payments', operation: 'delete', id: paymentId });
    if (!removed.ok) leftovers.push(`cobro ${invoiceNumber}`);
  }
  if (invoiceId) {
    const removed = await callMaster(cfg, { resource: 'invoices', operation: 'delete', id: invoiceId });
    if (!removed.ok) leftovers.push(`factura ${invoiceNumber}`);
  }
  const clientGone = await callMaster(cfg, { resource: 'clients', operation: 'delete', email });
  if (!clientGone.ok) leftovers.push(`cliente ${email}`);
  steps.push({
    step: 'borrado',
    label: 'Borrado de datos de prueba',
    ok: leftovers.length === 0,
    detail: leftovers.length === 0 ? 'Todo lo creado quedó borrado' : `Quedó sin borrar: ${leftovers.join(', ')}`
  });

  return {
    date: new Date().toISOString(),
    ok: steps.every((step) => step.ok),
    steps,
    leftovers
  };
}

function testDetail(test) {
  const failed = (test?.steps || []).find((step) => !step.ok);
  if (!failed) return '';
  return `${failed.label || failed.step}: ${failed.detail || 'sin detalle'}`.slice(0, 500);
}

async function findTestRow(svc) {
  const rows = await svc.entities[OUTBOX].filter({ idempotency_key: TEST_KEY }, '-created_date', 1);
  return rows?.[0] || null;
}

// El resultado vive en la cola hasta que TLEC CARGO lo recibe.
async function saveTestRun(svc, test) {
  const row = await findTestRow(svc);
  const data = {
    payload: { test },
    label: test.ok ? 'Prueba de conexión correcta' : 'Prueba de conexión con fallas',
    status: 'error',
    attempts: (Number(row?.attempts) || 0) + 1,
    last_attempt_date: test.date,
    last_error: test.ok ? '' : testDetail(test),
    master_response: ''
  };
  if (row) return await svc.entities[OUTBOX].update(row.id, data);
  return await svc.entities[OUTBOX].create({
    resource: 'health',
    record_id: 'prueba',
    idempotency_key: TEST_KEY,
    ...data
  });
}

async function markTestDelivered(svc, test) {
  const row = await findTestRow(svc);
  if (!row) return;
  await svc.entities[OUTBOX].update(row.id, {
    status: 'enviado',
    sent_date: new Date().toISOString(),
    last_error: '',
    master_response: test?.ok ? 'Resultado recibido por TLEC CARGO' : 'Fallas reportadas a TLEC CARGO'
  });
}

async function pendingTestResult(svc) {
  const row = await findTestRow(svc);
  if (!row || row.status === 'enviado') return null;
  return row.payload?.test || null;
}

// Automática una vez al día: no se repite en cada ciclo de 15 minutos.
async function isTestDue(svc) {
  const row = await findTestRow(svc);
  if (!row) return true;
  const last = row.sent_date || row.last_attempt_date || row.created_date;
  const time = last ? new Date(last).getTime() : 0;
  return !time || Date.now() - time >= TEST_INTERVAL_MS;
}

async function verifyConnection(svc, cfg) {
  let row = await findRow(svc, 'health');
  if (!row) {
    row = await svc.entities[OUTBOX].create({
      resource: 'health',
      idempotency_key: 'health',
      label: 'Prueba de conexión',
      payload: { resource: 'health' },
      status: 'pendiente',
      attempts: 0
    });
  }

  const result = await callMaster(cfg, { resource: 'health' });
  const attempts = (Number(row.attempts) || 0) + 1;
  const now = new Date().toISOString();

  if (result.ok) {
    const name = result.data?.app?.name || '';
    await svc.entities[OUTBOX].update(row.id, {
      status: 'enviado',
      attempts,
      last_attempt_date: now,
      sent_date: now,
      last_error: '',
      master_response: name,
      label: name ? `Prueba de conexión · ${name}` : 'Prueba de conexión'
    });
    return { ok: true, master_name: name, message: name ? `Conectado con ${name}` : 'Conexión verificada' };
  }

  const message = String(result.data?.error?.message || result.error || `Error ${result.status}`).slice(0, 400);
  await svc.entities[OUTBOX].update(row.id, {
    status: 'error',
    attempts,
    last_attempt_date: now,
    last_error: message
  });
  return { ok: false, message, code: result.data?.error?.code || '' };
}

// Reporte de estado: al cerrar cada ciclo la copia cuenta a la maestra cómo está,
// aunque no tenga nada pendiente. Un reporte fallido nunca afecta los envíos.
async function sendStatusReport(svc, cfg, test) {
  try {
    const errors = await svc.entities[OUTBOX].filter({ status: 'error' }, '-updated_date', REPORT_LIMIT);
    const list = (errors || []).filter((row) => row.idempotency_key !== TEST_KEY);
    const last = list[0] || null;
    // Si la prueba anterior no llegó a entregarse, viaja ahora.
    const include = test || (await pendingTestResult(svc));
    const result = await callMaster(cfg, {
      resource: 'health',
      report: {
        configured: cfg.configured,
        missing: cfg.missing,
        pending: list.length,
        last_error: last?.last_error || '',
        last_error_date: last?.last_attempt_date || '',
        ...(include ? { test: include } : {})
      }
    });
    if (result.ok && include) await markTestDelivered(svc, include);
    return result;
  } catch (_) {
    return { ok: false };
  }
}

function isRecent(value) {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return false;
  return Date.now() - time <= SCAN_WINDOW_MS;
}

// Reintenta lo pendiente y recoge lo que se haya quedado sin enviar (últimas 24 h).
async function flushOutbox(svc, cfg) {
  const summary = { retried: 0, sent: 0, failed: 0, scanned: 0 };

  const errors = await svc.entities[OUTBOX].filter({ status: 'error' }, '-updated_date', RETRY_LIMIT);
  for (const row of errors || []) {
    if (row.resource === 'health') continue;
    summary.retried += 1;
    const res = await attempt(svc, cfg, row);
    if (res.ok) summary.sent += 1;
    else summary.failed += 1;
  }

  const users = await svc.entities.User.filter({ role: 'user' }, '-created_date', SCAN_LIMIT);
  for (const client of users || []) {
    if (!client.email || !isRecent(client.created_date)) continue;
    summary.scanned += 1;
    const res = await syncClient(svc, cfg, client.email);
    if (res.ok && !res.already) summary.sent += 1;
  }

  const packages = await svc.entities.Package.filter({ status: 'pre_alerta' }, '-created_date', SCAN_LIMIT);
  for (const pkg of packages || []) {
    if (!pkg.client_email || !isRecent(pkg.created_date)) continue;
    summary.scanned += 1;
    const res = await syncPrealert(svc, cfg, pkg.id);
    if (res.ok && !res.already) summary.sent += 1;
  }

  // La copia reporta su estado a la maestra al cerrar el ciclo, aunque no tenga pendientes.
  // La respuesta del servicio dice cómo se llama esta copia y si el administrador
  // pidió una prueba de conexión desde el diagnóstico de TLEC CARGO.
  const probe = await sendStatusReport(svc, cfg, null);
  summary.reported = probe.ok;

  const slug = String(probe?.data?.app?.slug || '').toLowerCase();
  const requested = probe?.data?.test_requested === true;
  if (slug && (requested || (await isTestDue(svc)))) {
    const test = await runConnectionTest(cfg, slug);
    await saveTestRun(svc, test);
    const sent = await sendStatusReport(svc, cfg, test);
    summary.tested = true;
    summary.test_ok = test.ok;
    summary.test_sent = sent.ok;
  }

  return summary;
}

async function buildStatus(svc) {
  const cfg = masterConfig();
  const [apps, healthRows, errors, lastPrealerts, lastClients] = await Promise.all([
    svc.entities.IntegratedApp.list('-created_date', 1),
    svc.entities[OUTBOX].filter({ idempotency_key: 'health' }, '-created_date', 1),
    svc.entities[OUTBOX].filter({ status: 'error' }, '-updated_date', 100),
    svc.entities[OUTBOX].filter({ status: 'enviado', resource: 'prealerts' }, '-updated_date', 1),
    svc.entities[OUTBOX].filter({ status: 'enviado', resource: 'clients' }, '-updated_date', 1)
  ]);

  const health = healthRows?.[0] || null;
  const lastError = errors?.[0] || null;
  const prealert = lastPrealerts?.[0] || null;
  const client = lastClients?.[0] || null;
  const lastSent = [prealert, client]
    .filter(Boolean)
    .sort((a, b) => new Date(b.sent_date || 0) - new Date(a.sent_date || 0))[0] || null;

  return {
    ok: true,
    is_master: (apps || []).length > 0,
    configured: cfg.configured,
    missing: cfg.missing,
    endpoint: cfg.url || DEFAULT_ENDPOINT,
    master_name: health?.master_response || '',
    last_verified: health?.sent_date || '',
    last_sent: lastSent?.sent_date || '',
    last_sent_label: lastSent?.label || '',
    pending: (errors || []).length,
    last_error: lastError?.last_error || '',
    last_error_label: lastError?.label || '',
    last_error_date: lastError?.last_attempt_date || ''
  };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (_) {
      user = null;
    }
    const svc = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || 'status').trim().toLowerCase();

    if (action === 'status') {
      return Response.json(await buildStatus(svc));
    }

    if (action === 'test') {
      if (!user || user.role !== 'admin') {
        return Response.json({ ok: false, error: 'Solo un administrador puede probar la conexión' }, { status: 403 });
      }
      const cfg = masterConfig();
      if (!cfg.configured) {
        return Response.json({ ok: false, configured: false, missing: cfg.missing, message: `Falta guardar: ${cfg.missing.join(', ')}` });
      }
      const result = await verifyConnection(svc, cfg);
      return Response.json({ ...result, configured: true, missing: [] });
    }

    if (action === 'sync_client') {
      const email = String(body?.email || user?.email || '').trim().toLowerCase();
      if (!user && !email) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
      if (user && user.role !== 'admin' && email !== String(user.email || '').trim().toLowerCase()) {
        return Response.json({ ok: false, error: 'Solo puedes enviar tu propio registro' }, { status: 403 });
      }
      const result = await syncClient(svc, masterConfig(), email);
      return Response.json(result);
    }

    if (action === 'sync_prealert') {
      const result = await syncPrealert(svc, masterConfig(), body?.package_id);
      return Response.json(result);
    }

    if (action === 'retry' || action === 'flush') {
      if (user && user.role !== 'admin') {
        return Response.json({ ok: false, error: 'Solo un administrador puede reintentar los envíos' }, { status: 403 });
      }
      const cfg = masterConfig();
      if (!cfg.configured) {
        return Response.json({ ok: false, configured: false, missing: cfg.missing, message: 'Falta configurar la conexión con TLEC CARGO' });
      }
      const summary = await flushOutbox(svc, cfg);
      return Response.json({ ok: true, configured: true, summary });
    }

    return Response.json({ ok: false, error: `Acción no soportada: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'Error inesperado' }, { status: 500 });
  }
}