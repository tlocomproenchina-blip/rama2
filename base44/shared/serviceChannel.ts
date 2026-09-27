import {
  configKeyForCompany,
  findCompanyByKey,
  getCompanyConfig,
  isPlatformCompany,
  logCompanyUsage,
  PLATFORM_COMPANY_CODE,
  platformServiceKey,
  touchServiceKeyUsage,
} from "./companyContext.ts";
import { signCompanyActor } from "./actorContext.ts";

// Canal de servicio total: una sola puerta desde TLEC hacia la app de cada socia.
// Capacidades: entidades (lectura y escritura), funciones de backend, archivos,
// directorio de clientes, configuración y lotes. La llave de la empresa manda:
// sin ella no se lee ni se escribe nada, y cada operación queda registrada.

// Entidades cuyo dueño es el cliente: la socia solo ve y toca las de sus clientes.
export const CLIENT_OWNED_ENTITIES = [
  'Package',
  'Bulto',
  'CbmIngreso',
  'Consolidation',
  'ConsolidationRequest',
  'Invoice',
  'ClientCredit',
  'ClientNote',
  'AssistedPaymentRequest',
];

// Entidades reservadas a TLEC.
export const COMPANY_ONLY_ENTITIES = ['Company', 'CompanyClient', 'CompanyUsageLog'];

const READ_OPS = ['list', 'filter', 'get', 'schema'];
const MAX_LIMIT = 2000;
const CLIENT_CACHE_MS = 5 * 60 * 1000;

const keyCache = new Map();
const clientCache = new Map();

class ChannelError extends Error {
  constructor(message, status = 400, meta = {}) {
    super(message);
    this.status = status;
    this.meta = meta;
  }
}

export function clearChannelCache() {
  keyCache.clear();
  clientCache.clear();
}

export async function resolveChannelCompany(base44, key) {
  const clean = String(key || '').trim();
  if (!clean) return { error: 'Falta la llave de servicio', status: 401 };

  const platformKey = platformServiceKey();
  if (platformKey && clean === platformKey) {
    return {
      company: {
        company_code: PLATFORM_COMPANY_CODE,
        is_platform_owner: true,
        status: 'activa',
        config_key: 'main',
      },
    };
  }

  const cached = keyCache.get(clean);
  if (cached && Date.now() - cached.ts < 60000) {
    if (String(cached.company.status || 'activa') !== 'activa') {
      return { error: 'El acceso de esta empresa está desactivado', status: 403 };
    }
    return { company: cached.company };
  }

  const company = await findCompanyByKey(base44, clean);
  if (!company) return { error: 'Llave de servicio inválida', status: 401 };
  if (String(company.status || 'activa') !== 'activa') {
    return { error: 'El acceso de esta empresa está desactivado', status: 403 };
  }
  keyCache.set(clean, { company, ts: Date.now() });
  return { company };
}

function clampLimit(limit) {
  const value = Number(limit) || 200;
  return Math.max(1, Math.min(MAX_LIMIT, value));
}

function safeEntityName(entity) {
  const name = String(entity || '').trim();
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new ChannelError('Nombre de entidad inválido');
  return name;
}

export function isClientOwnedEntity(entity) {
  return CLIENT_OWNED_ENTITIES.includes(entity);
}

async function companyClientEmails(base44, companyCode) {
  const cached = clientCache.get(companyCode);
  if (cached && Date.now() - cached.ts < CLIENT_CACHE_MS) return cached.emails;

  const found = new Set();
  for (let skip = 0; skip < 3000; skip += 500) {
    const rows = await base44.asServiceRole.entities.CompanyClient
      .filter({ company_code: companyCode }, 'client_email', 500, skip)
      .catch(() => []);
    if (!rows?.length) break;
    rows.forEach((row) => {
      if (row?.client_email && row.is_active !== false) found.add(String(row.client_email).trim().toLowerCase());
    });
    if (rows.length < 500) break;
  }
  const emails = Array.from(found);
  clientCache.set(companyCode, { emails, ts: Date.now() });
  return emails;
}

function isOwnedByEmail(emails, email) {
  return !!email && emails.includes(String(email).trim().toLowerCase());
}

async function scopeQuery(base44, company, entity, query) {
  const scoped = { ...(query || {}) };
  if (isPlatformCompany(company)) return { empty: false, query: scoped };

  if (entity === 'AppConfig') {
    const configKey = configKeyForCompany(company);
    if (!scoped.config_key || scoped.config_key === 'main') scoped.config_key = configKey;
    return { empty: false, query: scoped };
  }

  if (isClientOwnedEntity(entity)) {
    const emails = await companyClientEmails(base44, company.company_code);
    if (typeof scoped.client_email === 'string') {
      return { empty: !isOwnedByEmail(emails, scoped.client_email), query: scoped };
    }
    if (!emails.length) return { empty: true, query: scoped };
    scoped.client_email = { $in: emails };
  }
  return { empty: false, query: scoped };
}

async function assertRecordAccess(base44, company, entity, record) {
  if (isPlatformCompany(company)) return;
  if (entity === 'AppConfig') {
    if (String(record?.config_key || '') !== configKeyForCompany(company)) {
      throw new ChannelError('Esa configuración pertenece a otra empresa', 403);
    }
    return;
  }
  if (isClientOwnedEntity(entity)) {
    const emails = await companyClientEmails(base44, company.company_code);
    if (!isOwnedByEmail(emails, record?.client_email)) {
      throw new ChannelError('Ese registro pertenece a otra empresa', 403);
    }
  }
}

async function prepareWrite(base44, company, entity, data) {
  const payload = { ...(data || {}) };
  if (isPlatformCompany(company)) return payload;

  if (entity === 'AppConfig') {
    payload.config_key = configKeyForCompany(company);
    return payload;
  }

  if (isClientOwnedEntity(entity)) {
    const email = String(payload.client_email || '').trim();
    if (!email) {
      throw new ChannelError('El registro necesita el correo de un cliente de la empresa', 400);
    }
    const emails = await companyClientEmails(base44, company.company_code);
    if (!isOwnedByEmail(emails, email)) {
      throw new ChannelError(`El cliente ${email} no pertenece a esta empresa`, 403);
    }
  }
  return payload;
}

function prepareUpdate(company, entity, data, record) {
  const payload = { ...(data || {}) };
  if (isPlatformCompany(company)) return payload;
  if (entity === 'AppConfig') {
    payload.config_key = record?.config_key || configKeyForCompany(company);
  }
  return payload;
}

async function runEntities(base44, company, params, actor) {
  const op = String(params?.op || '').toLowerCase();
  const entity = safeEntityName(params?.entity);
  if (!op) throw new ChannelError('Falta la operación (op)');
  if (COMPANY_ONLY_ENTITIES.includes(entity) && !isPlatformCompany(company)) {
    throw new ChannelError('Entidad reservada a TLEC', 403);
  }
  const target = base44.asServiceRole.entities[entity];
  if (!target || (READ_OPS.concat(['create', 'bulkCreate', 'update', 'bulkUpdate', 'updateMany', 'delete', 'deleteMany']).includes(op) === false)) {
    throw new ChannelError(`Operación no soportada: ${entity}.${op}`);
  }
  if (typeof target[op] !== 'function') {
    throw new ChannelError(`Operación no disponible: ${entity}.${op}`);
  }

  const meta = {
    capability: READ_OPS.includes(op) ? 'lectura' : 'escritura',
    action: op,
    entity_name: entity,
  };

  if (op === 'schema') {
    const schema = await target.schema();
    return { body: { ok: true, schema }, meta };
  }

  if (op === 'list') {
    const scope = await scopeQuery(base44, company, entity, {});
    if (scope.empty) return { body: { ok: true, data: [], count: 0 }, meta };
    const data = await target.list(params.sort || '-created_date', clampLimit(params.limit), Number(params.skip) || 0);
    const rows = data || [];
    return { body: { ok: true, data: rows, count: rows.length }, meta: { ...meta, record_count: rows.length } };
  }

  if (op === 'filter') {
    const scope = await scopeQuery(base44, company, entity, params.query);
    if (scope.empty) return { body: { ok: true, data: [], count: 0 }, meta };
    const data = await target.filter(scope.query, params.sort || '-created_date', clampLimit(params.limit), Number(params.skip) || 0);
    const rows = data || [];
    return { body: { ok: true, data: rows, count: rows.length }, meta: { ...meta, record_count: rows.length } };
  }

  if (op === 'get') {
    const record = await target.get(String(params.id || '')).catch(() => null);
    if (!record) throw new ChannelError('Registro no encontrado', 404);
    await assertRecordAccess(base44, company, entity, record);
    return { body: { ok: true, data: record }, meta: { ...meta, record_count: 1 } };
  }

  if (op === 'create') {
    const payload = await prepareWrite(base44, company, entity, params.data);
    const created = await target.create(payload);
    return { body: { ok: true, data: created }, meta: { ...meta, record_count: 1 } };
  }

  if (op === 'bulkCreate') {
    const items = Array.isArray(params.items) ? params.items : [];
    if (!items.length) throw new ChannelError('items está vacío');
    const prepared = [];
    for (const item of items) prepared.push(await prepareWrite(base44, company, entity, item));
    const created = await target.bulkCreate(prepared);
    return { body: { ok: true, data: created }, meta: { ...meta, record_count: prepared.length } };
  }

  if (op === 'update') {
    const id = String(params.id || '');
    const record = await target.get(id).catch(() => null);
    if (!record) throw new ChannelError('Registro no encontrado', 404);
    await assertRecordAccess(base44, company, entity, record);
    const updated = await target.update(id, prepareUpdate(company, entity, params.data, record));
    return { body: { ok: true, data: updated }, meta: { ...meta, record_count: 1 } };
  }

  if (op === 'bulkUpdate') {
    const items = Array.isArray(params.items) ? params.items : [];
    if (!items.length) throw new ChannelError('items está vacío');
    const allowed = [];
    for (const item of items) {
      if (!item?.id) continue;
      const record = await target.get(String(item.id)).catch(() => null);
      if (!record) continue;
      await assertRecordAccess(base44, company, entity, record);
      const { id, ...data } = item;
      allowed.push({ id, ...prepareUpdate(company, entity, data, record) });
    }
    const updated = await target.bulkUpdate(allowed);
    return { body: { ok: true, data: updated }, meta: { ...meta, record_count: allowed.length } };
  }

  if (op === 'updateMany') {
    if (!isPlatformCompany(company) && !isClientOwnedEntity(entity)) {
      throw new ChannelError('Las actualizaciones masivas solo se permiten sobre las cargas de la empresa', 403);
    }
    const scope = await scopeQuery(base44, company, entity, params.query);
    if (scope.empty) throw new ChannelError('La consulta no coincide con cargas de esta empresa', 400);
    const result = await target.updateMany(scope.query, params.update || {});
    return { body: { ok: true, data: result }, meta };
  }

  if (op === 'delete') {
    const id = String(params.id || '');
    const record = await target.get(id).catch(() => null);
    if (!record) throw new ChannelError('Registro no encontrado', 404);
    await assertRecordAccess(base44, company, entity, record);
    await target.delete(id);
    return { body: { ok: true, deleted: true }, meta: { ...meta, record_count: 1 } };
  }

  if (op === 'deleteMany') {
    if (!isPlatformCompany(company) && !isClientOwnedEntity(entity)) {
      throw new ChannelError('Las bajas masivas solo se permiten sobre las cargas de la empresa', 403);
    }
    const scope = await scopeQuery(base44, company, entity, params.query);
    if (scope.empty) throw new ChannelError('La consulta no coincide con cargas de esta empresa', 400);
    const result = await target.deleteMany(scope.query);
    return { body: { ok: true, data: result }, meta };
  }

  throw new ChannelError(`Operación no soportada: ${op}`);
}

async function runFunctions(base44, company, params, actor) {
  const name = String(params?.function_name || '').trim();
  if (!name) throw new ChannelError('Falta function_name');
  const meta = { capability: 'funcion', action: 'invoke', function_name: name };
  const actorPayload = await signCompanyActor(company, actor);

  let response;
  try {
    response = await base44.asServiceRole.functions.invoke(name, {
      ...(params?.params || {}),
      ...(actorPayload ? { _company_actor: actorPayload } : {}),
    });
  } catch (error) {
    const detail = error?.response?.data?.error || error?.message || 'Error al ejecutar la función';
    throw new ChannelError(`La función ${name} respondió: ${detail}`, error?.response?.status || 500, meta);
  }

  const data = response?.data !== undefined ? response.data : response;
  if (data?.error) {
    const status = Number(response?.status) || 400;
    throw new ChannelError(`La función ${name} respondió: ${data.error}`, status < 400 ? 400 : status, meta);
  }
  return { body: { ok: true, data }, meta };
}

async function runFiles(base44, company, params, file) {
  const op = String(params?.op || 'upload_private');
  const meta = { capability: 'archivos', action: op };
  const core = base44.asServiceRole.integrations.Core;

  if (op === 'upload_private' || op === 'upload_public') {
    if (!file) throw new ChannelError('Falta el archivo (multipart/form-data, campo "file")');
    const out = op === 'upload_private'
      ? await core.UploadPrivateFile({ file })
      : await core.UploadPublicFile({ file });
    const reference = out?.file_uri || out?.file_url || '';
    return {
      body: op === 'upload_private'
        ? { ok: true, file_uri: reference, data: out }
        : { ok: true, file_url: reference, data: out },
      meta: { ...meta, record_count: 1 },
    };
  }

  if (op === 'signed_url') {
    const fileUri = String(params?.file_uri || '').trim();
    if (!fileUri) throw new ChannelError('Falta file_uri');
    const out = await core.CreateFileSignedUrl({ file_uri: fileUri, expires_in: Number(params.expires_in) || 3600 });
    return { body: { ok: true, signed_url: out?.signed_url || '' }, meta: { ...meta, record_count: 1 } };
  }

  throw new ChannelError(`Operación de archivos no soportada: ${op}`);
}

async function runClientDirectory(base44, company, params) {
  const op = String(params?.op || 'upsert');
  const meta = { capability: 'directorio', action: op };
  if (isPlatformCompany(company)) throw new ChannelError('El directorio de clientes es propio de cada empresa socia');

  const code = company.company_code;
  const clientEntity = base44.asServiceRole.entities.CompanyClient;

  if (op === 'upsert') {
    const input = params?.client || {};
    const email = String(input.client_email || input.email || '').trim();
    if (!email) throw new ChannelError('Falta el correo del cliente');
    const payload = {
      company_code: code,
      client_email: email,
      full_name: input.full_name || '',
      first_name: input.first_name || '',
      last_name: input.last_name || '',
      cedula: input.cedula || '',
      whatsapp: input.whatsapp || '',
      address: input.address || '',
      city: input.city || '',
      state: input.state || '',
      shipping_mark: input.shipping_mark || '',
      is_active: input.is_active !== false,
      last_sync_date: new Date().toISOString(),
    };
    const existing = await clientEntity.filter({ company_code: code, client_email: email }, '-created_date', 1);
    const row = existing?.[0];
    const saved = row ? await clientEntity.update(row.id, payload) : await clientEntity.create(payload);
    clientCache.delete(code);
    return { body: { ok: true, data: saved }, meta: { ...meta, record_count: 1 } };
  }

  if (op === 'list') {
    const data = await clientEntity.filter({ company_code: code }, 'client_email', clampLimit(params.limit), Number(params.skip) || 0);
    const rows = data || [];
    return { body: { ok: true, data: rows, count: rows.length }, meta: { ...meta, record_count: rows.length } };
  }

  if (op === 'get') {
    const email = String(params?.client_email || '').trim();
    if (!email) throw new ChannelError('Falta client_email');
    const rows = await clientEntity.filter({ company_code: code, client_email: email }, '-created_date', 1);
    return { body: { ok: true, data: rows?.[0] || null }, meta };
  }

  if (op === 'deactivate') {
    const email = String(params?.client_email || '').trim();
    const rows = await clientEntity.filter({ company_code: code, client_email: email }, '-created_date', 1);
    if (!rows?.[0]) throw new ChannelError('Cliente no encontrado', 404);
    const saved = await clientEntity.update(rows[0].id, { is_active: false, last_sync_date: new Date().toISOString() });
    clientCache.delete(code);
    return { body: { ok: true, data: saved }, meta: { ...meta, record_count: 1 } };
  }

  throw new ChannelError(`Operación de directorio no soportada: ${op}`);
}

export async function runChannelAction(base44, request) {
  const startedAt = Date.now();
  const action = String(request?.action || 'health');
  const params = request?.params || {};
  const actor = request?.actor || null;
  const file = request?.file || null;

  const auth = await resolveChannelCompany(base44, request?.key);
  if (auth.error) return { status: auth.status, body: { ok: false, error: auth.error } };
  const company = auth.company;

  const dispatch = async (currentAction, currentParams, currentFile) => {
    switch (currentAction) {
      case 'health':
        return {
          body: {
            ok: true,
            service: 'appServiceAccess',
            company_code: company.company_code,
            company_name: company.name || PLATFORM_COMPANY_CODE,
            capabilities: ['entities', 'functions', 'files', 'batch', 'clientDirectory', 'config'],
            timestamp: new Date().toISOString(),
          },
          meta: { capability: 'salud', action: 'health' },
        };
      case 'config': {
        const row = await getCompanyConfig(base44, company);
        return {
          body: {
            ok: true,
            company_code: company.company_code,
            config_key: row?.config_key || configKeyForCompany(company),
            brand: row ? {
              app_name: row.app_name || '',
              app_tagline: row.app_tagline || '',
              app_logo_url: row.app_logo_url || '',
              favicon_url: row.favicon_url || '',
              brand_color: row.brand_color || '',
              invoice_company_name: row.invoice_company_name || '',
              invoice_logo_url: row.invoice_logo_url || '',
            } : null,
          },
          meta: { capability: 'configuracion', action: 'config' },
        };
      }
      case 'entities':
        return await runEntities(base44, company, currentParams, actor);
      case 'functions':
        return await runFunctions(base44, company, currentParams, actor);
      case 'files':
        return await runFiles(base44, company, currentParams, currentFile);
      case 'clientDirectory':
        return await runClientDirectory(base44, company, currentParams);
      case 'batch': {
        const operations = Array.isArray(currentParams?.operations) ? currentParams.operations.slice(0, 25) : [];
        if (!operations.length) throw new ChannelError('operations está vacío');
        const results = [];
        for (const item of operations) {
          try {
            const out = await dispatch(String(item?.action || 'entities'), item?.params || {}, currentFile);
            results.push({ ok: true, action: item?.action || 'entities', body: out.body });
          } catch (error) {
            results.push({ ok: false, action: item?.action || 'entities', error: error.message });
          }
        }
        return { body: { ok: true, results }, meta: { capability: 'lote', action: 'batch', record_count: results.length } };
      }
      default:
        throw new ChannelError(`Acción no soportada: ${currentAction}`);
    }
  };

  let status = 200;
  let meta = { capability: action, action };
  let body;
  try {
    const out = await dispatch(action, params, file);
    body = out.body;
    meta = out.meta || meta;
    status = out.status || 200;
  } catch (error) {
    status = error instanceof ChannelError ? error.status : 500;
    meta = { ...meta, ...(error?.meta || {}) };
    body = { ok: false, error: error.message };
  }

  if (!isPlatformCompany(company)) {
    await logCompanyUsage(base44, {
      ...meta,
      company_code: company.company_code,
      actor_email: actor?.email || '',
      actor_role: actor?.role || '',
      success: status < 400,
      error_message: status >= 400 ? body?.error || '' : '',
      duration_ms: Date.now() - startedAt,
    });
    await touchServiceKeyUsage(base44, company);
  }

  return { status, body };
}