import { originStamp, ownedByApp } from './integratedApps.ts';

export const RESOURCE_LABELS = {
  clients: 'Clientes',
  prealerts: 'Pre-alertas',
  invoices: 'Facturas',
  payments: 'Cobros'
};

const CLIENT_FIELDS = ['first_name', 'last_name', 'cedula', 'state', 'city', 'whatsapp', 'whatsapp_normalized', 'address', 'shipping_mark'];
const PREALERT_FIELDS = ['tracking_number', 'shipping_company', 'shipping_type', 'risk_category', 'package_count', 'description', 'has_insurance', 'fob_value', 'invoice_url', 'product_image_url', 'seller_delivery_date', 'shipping_address', 'label_code'];
const INVOICE_FIELDS = ['invoice_number', 'invoice_date', 'due_date', 'items', 'subtotal', 'tax', 'total', 'notes', 'status', 'consolidation_id', 'consolidation_tracking', 'billed_cbm', 'total_cbm', 'manual_recibos', 'cost_breakdown'];
const PAYMENT_FIELDS = ['amount', 'method', 'proof_url', 'reference', 'status', 'reported_date', 'description'];

const PAYMENT_STATUSES = ['pendiente', 'aprobado', 'rechazado'];
const INVOICE_STATUSES = ['pendiente', 'revision', 'pagada', 'vencida', 'cancelada'];

function fail(code, message, status = 400) {
  return { status, body: { ok: false, error: { code, message } } };
}

function done(body, status = 200, audit = null) {
  return { status, body, audit };
}

function pick(data, fields) {
  const out = {};
  for (const field of fields) {
    if (data && data[field] !== undefined && data[field] !== null) out[field] = data[field];
  }
  return out;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function limitOf(payload) {
  return Math.min(Math.max(Number(payload?.limit) || 100, 1), 500);
}

function sortOf(payload) {
  const sort = String(payload?.sort || '').trim();
  return sort || '-created_date';
}

function scopeQuery(app, payload, extra = {}) {
  const query = { origin_app_id: app.id, ...extra };
  const email = normalizeEmail(payload?.client_email);
  if (email) query.client_email = email;
  return query;
}

function clientShape(record, account) {
  const name = record.full_name || [record.first_name, record.last_name].filter(Boolean).join(' ');
  return {
    id: record.id,
    email: record.email || record.client_email || null,
    account,
    first_name: record.first_name || null,
    last_name: record.last_name || null,
    full_name: name || null,
    cedula: record.cedula || null,
    state: record.state || null,
    city: record.city || null,
    whatsapp: record.whatsapp || null,
    address: record.address || null,
    shipping_mark: record.shipping_mark || null,
    created_date: record.created_date || null,
    updated_date: record.updated_date || null
  };
}

async function loadRecord(base44, entity, id) {
  if (!id) return null;
  try {
    return await base44.asServiceRole.entities[entity].get(id);
  } catch (_) {
    return null;
  }
}

// ---------- operaciones genéricas (pre-alertas, facturas) ----------

async function listEntity(base44, entity, app, payload) {
  const rows = await base44.asServiceRole.entities[entity].filter(
    scopeQuery(app, payload),
    sortOf(payload),
    limitOf(payload)
  );
  return done({ ok: true, records: rows || [] });
}

async function getEntity(base44, entity, app, payload) {
  const record = await loadRecord(base44, entity, payload?.id);
  if (!record) return fail('not_found', 'No existe un registro con ese id.', 404);
  if (!ownedByApp(record, app.id)) {
    return fail('not_yours', 'Ese registro no fue creado por esta app integrada.', 403);
  }
  return done({ ok: true, record });
}

async function updateEntity(base44, entity, app, payload, fields, label) {
  const record = await loadRecord(base44, entity, payload?.id);
  if (!record) return fail('not_found', 'No existe un registro con ese id.', 404);
  if (!ownedByApp(record, app.id)) {
    return fail('not_yours', 'Ese registro no fue creado por esta app integrada.', 403);
  }
  const changes = pick(payload?.data || {}, fields);
  if (Object.keys(changes).length === 0) {
    return fail('empty_update', 'Envía los campos a cambiar dentro de "data".');
  }
  const updated = await base44.asServiceRole.entities[entity].update(record.id, changes);
  return done(
    { ok: true, record: updated },
    200,
    { entity, recordId: updated.id, label, action: 'update', detail: Object.keys(changes).join(', ') }
  );
}

async function deleteEntity(base44, entity, app, payload, label) {
  const record = await loadRecord(base44, entity, payload?.id);
  if (!record) return fail('not_found', 'No existe un registro con ese id.', 404);
  if (!ownedByApp(record, app.id)) {
    return fail('not_yours', 'Ese registro no fue creado por esta app integrada.', 403);
  }
  await base44.asServiceRole.entities[entity].delete(record.id);
  return done(
    { ok: true, deleted: record.id },
    200,
    { entity, recordId: record.id, label, action: 'delete', detail: 'Registro eliminado' }
  );
}

function recordLabel(record) {
  return record?.tracking_number || record?.invoice_number || record?.email || record?.client_email || record?.id || '';
}

// ---------- pre-alertas ----------

// Validaciones comunes a crear y a validar una pre-alerta. El paso de validación
// existe para que la prueba de conexión compruebe el canal sin guardar nada.
async function checkPrealert(base44, app, payload) {
  const tracking = String(payload?.tracking_number || '').trim();
  const description = String(payload?.description || '').trim();
  if (!tracking) return { error: fail('missing_tracking', 'Falta el número de tracking de la pre-alerta.') };
  if (!description) return { error: fail('missing_description', 'Falta la descripción de la pre-alerta.') };

  const email = normalizeEmail(payload?.client_email);
  if (!email) return { error: fail('missing_client', 'Indica el client_email de la pre-alerta.') };

  const client = await findClient(base44, app, email);
  if (!client) {
    return { error: fail('client_not_found', `El cliente ${email} no está registrado por esta app integrada. Créalo primero con resource "clients".`, 404) };
  }
  const shippingMark = client.record?.shipping_mark || String(payload?.shipping_mark || '').trim();
  if (!shippingMark) {
    return { error: fail('missing_shipping_mark', `El cliente ${email} todavía no tiene shipping mark en TLEC CARGO. Cárgalo en clients.create/update para poder pre-alertar su carga.`) };
  }
  return { tracking, description, email, shippingMark };
}

// Valida la pre-alerta sin guardarla: guardarla dispararía avisos y correos.
async function validatePrealert(base44, app, payload) {
  const check = await checkPrealert(base44, app, payload);
  if (check.error) return check.error;
  return done({
    ok: true,
    validated: true,
    tracking_number: check.tracking,
    client_email: check.email,
    shipping_mark: check.shippingMark
  });
}

async function createPrealert(base44, app, payload) {
  const check = await checkPrealert(base44, app, payload);
  if (check.error) return check.error;
  const { tracking, description, email, shippingMark } = check;

  const existing = await base44.asServiceRole.entities.Package.filter({ tracking_number: tracking }, '-created_date', 10);
  const mine = (existing || []).find((p) => p.origin_app_id === app.id);
  if (mine) return fail('duplicate_tracking', 'Ese tracking ya fue registrado por esta app integrada.', 409);
  const otherCopy = (existing || []).find((p) => p.origin_app_id && p.origin_app_id !== app.id);
  if (otherCopy) return fail('tracking_taken', 'Ese tracking ya está registrado en TLEC CARGO por otra app integrada.', 409);
  const masterOwned = (existing || []).find((p) => !p.is_orphan && !p.origin_app_id);
  if (masterOwned) return fail('duplicate_tracking', 'Este número de tracking ya ha sido registrado en TLEC CARGO.', 409);

  const data = {
    ...pick(payload, PREALERT_FIELDS),
    tracking_number: tracking,
    description,
    shipping_type: payload?.shipping_type === 'maritimo' ? 'maritimo' : 'aereo',
    risk_category: payload?.risk_category === 'alto_riesgo' ? 'alto_riesgo' : 'general',
    package_count: Number(payload?.package_count) || 1,
    client_email: email,
    shipping_mark: shippingMark,
    ...originStamp(app)
  };
  delete data.shipping_mark_override;

  const orphan = (existing || []).find((p) => p.is_orphan);
  if (orphan) {
    const claimed = await base44.asServiceRole.entities.Package.update(orphan.id, {
      ...data,
      is_orphan: false,
      status: 'pre_alerta'
    });
    return done(
      { ok: true, action: 'claimed_orphan', record: claimed },
      200,
      { entity: 'Package', recordId: claimed.id, label: tracking, action: 'update', detail: 'Pre-alerta reclamó un paquete huérfano' }
    );
  }

  const created = await base44.asServiceRole.entities.Package.create({ ...data, status: 'pre_alerta' });
  return done(
    { ok: true, action: 'created', record: created },
    201,
    { entity: 'Package', recordId: created.id, label: tracking, action: 'create', detail: 'Pre-alerta registrada' }
  );
}

// ---------- facturas ----------

async function createInvoice(base44, app, payload) {
  const email = normalizeEmail(payload?.client_email);
  const total = Number(payload?.total);
  if (!email) return fail('missing_client', 'Indica el client_email de la factura.');
  if (!Number.isFinite(total)) return fail('missing_total', 'Falta el total de la factura.');

  const changes = pick(payload, INVOICE_FIELDS);
  const invoiceNumber = String(changes.invoice_number || '').trim()
    || `${String(app.slug || 'app').toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  const created = await base44.asServiceRole.entities.Invoice.create({
    ...changes,
    invoice_number: invoiceNumber,
    client_email: email,
    consolidation_id: String(changes.consolidation_id || ''),
    total,
    status: INVOICE_STATUSES.includes(changes.status) ? changes.status : 'pendiente',
    invoice_date: changes.invoice_date || new Date().toISOString(),
    paid_amount: 0,
    ...originStamp(app)
  });
  return done(
    { ok: true, action: 'created', record: created },
    201,
    { entity: 'Invoice', recordId: created.id, label: invoiceNumber, action: 'create', detail: 'Factura emitida' }
  );
}

// ---------- cobros ----------

async function resolveOwnedInvoice(base44, app, payload) {
  const invoiceId = String(payload?.invoice_id || '').trim();
  if (invoiceId) {
    const invoice = await loadRecord(base44, 'Invoice', invoiceId);
    if (invoice && ownedByApp(invoice, app.id)) return invoice;
    return null;
  }
  const invoiceNumber = String(payload?.invoice_number || '').trim();
  if (!invoiceNumber) return null;
  const rows = await base44.asServiceRole.entities.Invoice.filter(
    { invoice_number: invoiceNumber, origin_app_id: app.id },
    '-created_date',
    1
  );
  return rows?.[0] || null;
}

async function syncInvoicePaid(base44, invoiceId) {
  const payments = await base44.asServiceRole.entities.InvoicePayment.filter({ invoice_id: invoiceId }, '-created_date', 500);
  const paid = (payments || [])
    .filter((p) => p.status === 'aprobado')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const invoice = await loadRecord(base44, 'Invoice', invoiceId);
  if (!invoice) return null;
  const total = Number(invoice.total) || 0;
  let status = invoice.status;
  if (paid > 0 && total > 0 && paid >= total) status = 'pagada';
  else if (paid === 0 && invoice.status === 'pagada') status = 'pendiente';
  const updated = await base44.asServiceRole.entities.Invoice.update(invoiceId, {
    paid_amount: paid,
    ...(status !== invoice.status ? { status } : {})
  });
  return { id: updated.id, invoice_number: updated.invoice_number, paid_amount: paid, status: updated.status, total };
}

async function createPayment(base44, app, payload) {
  const invoice = await resolveOwnedInvoice(base44, app, payload);
  if (!invoice) {
    return fail('invoice_not_found', 'Indica el invoice_id (o invoice_number) de una factura creada por esta app integrada.', 404);
  }
  const amount = Number(payload?.amount);
  if (!Number.isFinite(amount) || amount <= 0) return fail('invalid_amount', 'El monto del cobro debe ser mayor a 0.');

  const changes = pick(payload, PAYMENT_FIELDS);
  const status = PAYMENT_STATUSES.includes(changes.status) ? changes.status : 'pendiente';
  const created = await base44.asServiceRole.entities.InvoicePayment.create({
    ...changes,
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number || '',
    client_email: invoice.client_email,
    amount,
    status,
    reported_date: changes.reported_date || new Date().toISOString(),
    ...originStamp(app)
  });
  const summary = status === 'aprobado' ? await syncInvoicePaid(base44, invoice.id) : null;
  return done(
    { ok: true, action: 'created', record: created, invoice: summary },
    201,
    { entity: 'InvoicePayment', recordId: created.id, label: invoice.invoice_number, action: 'create', detail: `Cobro de ${amount} USD` }
  );
}

async function updatePayment(base44, app, payload) {
  const record = await loadRecord(base44, 'InvoicePayment', payload?.id);
  if (!record) return fail('not_found', 'No existe un cobro con ese id.', 404);
  if (!ownedByApp(record, app.id)) {
    return fail('not_yours', 'Ese cobro no fue creado por esta app integrada.', 403);
  }
  const changes = pick(payload?.data || {}, PAYMENT_FIELDS);
  if (PAYMENT_STATUSES.includes(changes.status) === false) delete changes.status;
  if (Object.keys(changes).length === 0) {
    return fail('empty_update', 'Envía los campos a cambiar dentro de "data".');
  }
  const updated = await base44.asServiceRole.entities.InvoicePayment.update(record.id, changes);
  const touchedApproved = record.status === 'aprobado' || updated.status === 'aprobado';
  const summary = touchedApproved ? await syncInvoicePaid(base44, updated.invoice_id) : null;
  return done(
    { ok: true, record: updated, invoice: summary },
    200,
    { entity: 'InvoicePayment', recordId: updated.id, label: updated.invoice_number, action: 'update', detail: Object.keys(changes).join(', ') }
  );
}

// ---------- clientes ----------

async function findClient(base44, app, email) {
  const users = await base44.asServiceRole.entities.User.filter({ email, origin_app_id: app.id }, '-created_date', 1);
  if (users?.[0]) return { record: users[0], account: true, entity: 'User' };
  const profiles = await base44.asServiceRole.entities.IntegratedClient.filter(
    { client_email: email, origin_app_id: app.id },
    '-created_date',
    1
  );
  if (profiles?.[0]) return { record: profiles[0], account: false, entity: 'IntegratedClient' };
  return null;
}

async function createClient(base44, app, payload) {
  const email = normalizeEmail(payload?.email || payload?.client_email);
  if (!email) return fail('missing_email', 'Indica el email del cliente.');
  const profile = pick(payload, CLIENT_FIELDS);

  const users = await base44.asServiceRole.entities.User.filter({ email }, '-created_date', 5);
  const user = users?.[0];
  if (user) {
    if (user.origin_app_id && user.origin_app_id !== app.id) {
      return fail('client_taken', `El cliente ${email} pertenece a otra app integrada.`, 409);
    }
    if ((user.role || 'user') !== 'user') {
      return fail('client_is_staff', `El correo ${email} pertenece a un usuario interno de TLEC CARGO.`, 409);
    }
    const updated = await base44.asServiceRole.entities.User.update(user.id, { ...profile, ...originStamp(app) });
    return done(
      { ok: true, action: 'linked', client: clientShape(updated, true) },
      200,
      { entity: 'User', recordId: updated.id, label: email, action: 'update', detail: 'Cliente vinculado a la app integrada' }
    );
  }

  const profiles = await base44.asServiceRole.entities.IntegratedClient.filter({ client_email: email }, '-created_date', 5);
  const existing = profiles?.[0];
  if (existing) {
    if (existing.origin_app_id && existing.origin_app_id !== app.id) {
      return fail('client_taken', `El cliente ${email} pertenece a otra app integrada.`, 409);
    }
    const updated = await base44.asServiceRole.entities.IntegratedClient.update(existing.id, {
      ...profile,
      ...originStamp(app)
    });
    return done(
      { ok: true, action: 'updated', client: clientShape(updated, false) },
      200,
      { entity: 'IntegratedClient', recordId: updated.id, label: email, action: 'update', detail: 'Datos del cliente actualizados' }
    );
  }

  const created = await base44.asServiceRole.entities.IntegratedClient.create({
    client_email: email,
    ...profile,
    account_created: false,
    ...originStamp(app)
  });
  return done(
    { ok: true, action: 'created', client: clientShape(created, false) },
    201,
    { entity: 'IntegratedClient', recordId: created.id, label: email, action: 'create', detail: 'Cliente registrado sin cuenta de acceso' }
  );
}

async function resolveClientRecord(base44, app, payload) {
  const id = String(payload?.id || '').trim();
  if (id) {
    const user = await loadRecord(base44, 'User', id);
    if (user) return { record: user, account: true, entity: 'User' };
    const profile = await loadRecord(base44, 'IntegratedClient', id);
    if (profile) return { record: profile, account: false, entity: 'IntegratedClient' };
    return null;
  }
  const email = normalizeEmail(payload?.email || payload?.client_email);
  if (!email) return null;
  return await findClient(base44, app, email);
}

async function clientsOperation(base44, app, operation, payload) {
  if (operation === 'list') {
    const limit = limitOf(payload);
    const [users, profiles] = await Promise.all([
      base44.asServiceRole.entities.User.filter({ origin_app_id: app.id }, '-created_date', limit),
      base44.asServiceRole.entities.IntegratedClient.filter({ origin_app_id: app.id }, '-created_date', limit)
    ]);
    const clients = [
      ...(users || []).map((u) => clientShape(u, true)),
      ...(profiles || []).map((p) => clientShape(p, false))
    ];
    const search = String(payload?.search || '').trim().toLowerCase();
    const filtered = search
      ? clients.filter((c) => [c.email, c.full_name, c.cedula, c.shipping_mark].filter(Boolean).join(' ').toLowerCase().includes(search))
      : clients;
    return done({ ok: true, clients: filtered });
  }

  if (operation === 'get') {
    const found = await resolveClientRecord(base44, app, payload);
    if (!found) return fail('not_found', 'No existe un cliente con ese id o email para esta app integrada.', 404);
    if (!ownedByApp(found.record, app.id)) {
      return fail('not_yours', 'Ese cliente no fue registrado por esta app integrada.', 403);
    }
    return done({ ok: true, client: clientShape(found.record, found.account) });
  }

  if (operation === 'create') return await createClient(base44, app, payload);

  if (operation === 'update') {
    const found = await resolveClientRecord(base44, app, payload);
    if (!found) return fail('not_found', 'No existe un cliente con ese id o email para esta app integrada.', 404);
    if (!ownedByApp(found.record, app.id)) {
      return fail('not_yours', 'Ese cliente no fue registrado por esta app integrada.', 403);
    }
    const changes = pick(payload?.data || {}, CLIENT_FIELDS);
    if (Object.keys(changes).length === 0) {
      return fail('empty_update', 'Envía los campos a cambiar dentro de "data".');
    }
    const updated = await base44.asServiceRole.entities[found.entity].update(found.record.id, changes);
    return done(
      { ok: true, client: clientShape(updated, found.account) },
      200,
      { entity: found.entity, recordId: updated.id, label: updated.email || updated.client_email, action: 'update', detail: Object.keys(changes).join(', ') }
    );
  }

  if (operation === 'delete') {
    const found = await resolveClientRecord(base44, app, payload);
    if (!found) return fail('not_found', 'No existe un cliente con ese id o email para esta app integrada.', 404);
    if (!ownedByApp(found.record, app.id)) {
      return fail('not_yours', 'Ese cliente no fue registrado por esta app integrada.', 403);
    }
    await base44.asServiceRole.entities[found.entity].delete(found.record.id);
    return done(
      { ok: true, deleted: found.record.id },
      200,
      { entity: found.entity, recordId: found.record.id, label: found.record.email || found.record.client_email, action: 'delete', detail: 'Cliente eliminado' }
    );
  }

  return fail('unknown_operation', 'Operación no permitida para clientes. Usa list, get, create, update o delete.');
}

// ---------- router ----------

export async function runOperation(base44, app, resource, operation, payload) {
  if (resource === 'prealerts') {
    if (operation === 'list') return await listEntity(base44, 'Package', app, payload);
    if (operation === 'get') return await getEntity(base44, 'Package', app, payload);
    if (operation === 'create') return await createPrealert(base44, app, payload);
    if (operation === 'validate') return await validatePrealert(base44, app, payload);
    if (operation === 'update') return await updateEntity(base44, 'Package', app, payload, PREALERT_FIELDS, 'Pre-alerta');
    if (operation === 'delete') return await deleteEntity(base44, 'Package', app, payload, 'Pre-alerta');
  }

  if (resource === 'invoices') {
    if (operation === 'list') return await listEntity(base44, 'Invoice', app, payload);
    if (operation === 'get') return await getEntity(base44, 'Invoice', app, payload);
    if (operation === 'create') return await createInvoice(base44, app, payload);
    if (operation === 'update') return await updateEntity(base44, 'Invoice', app, payload, INVOICE_FIELDS, 'Factura');
    if (operation === 'delete') return await deleteEntity(base44, 'Invoice', app, payload, 'Factura');
  }

  if (resource === 'payments') {
    if (operation === 'list') return await listEntity(base44, 'InvoicePayment', app, payload);
    if (operation === 'get') return await getEntity(base44, 'InvoicePayment', app, payload);
    if (operation === 'create') return await createPayment(base44, app, payload);
    if (operation === 'update') return await updatePayment(base44, app, payload);
    if (operation === 'delete') {
      const result = await deleteEntity(base44, 'InvoicePayment', app, payload, 'Cobro');
      if (result.body?.ok && payload?.id) {
        const invoiceId = payload?.invoice_id;
        if (invoiceId) result.body.invoice = await syncInvoicePaid(base44, invoiceId);
      }
      return result;
    }
  }

  if (resource === 'clients') {
    return await clientsOperation(base44, app, operation, payload);
  }

  return fail('unknown_resource', `Recurso no permitido: ${resource}. Usa clients, prealerts, invoices o payments.`);
}

export function auditPayload(app, audit) {
  if (!audit) return null;
  return {
    entity_name: audit.entity,
    entity_id: audit.recordId || '',
    entity_label: audit.label || '',
    action_type: audit.action,
    action_detail: audit.detail || '',
    actor_email: `integrada:${app.slug}`,
    actor_name: app.name,
    actor_role: 'app_integrada',
    module_name: 'Apps Integradas',
    summary: `${audit.action} desde ${app.name}`
  };
}