import { secrets } from "base44:runtime";

// Contexto compartido de empresas (TLEC + empresas socias).
// Resuelve la empresa por su llave de servicio, sirve la configuración de cada
// empresa y registra el consumo para poder medir y cortar el acceso.

export const PLATFORM_COMPANY_CODE = 'TLEC';
export const PLATFORM_CONFIG_KEY = 'main';

const CONFIG_CACHE_MS = 60000;
const configCache = new Map();
const keyTouchCache = new Map();

const BRAND_SOURCE_FIELDS = [
  'app_name', 'app_tagline', 'app_logo_url', 'favicon_url', 'brand_color',
  'app_public_url', 'custom_domain',
  'invoice_company_name', 'invoice_company_address', 'invoice_company_city_zip',
  'invoice_company_country', 'invoice_company_phone', 'invoice_company_email',
  'invoice_logo_url',
];

export function normalizeCompanyCode(code) {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 16);
}

export function partnerConfigKey(code) {
  return `partner:${normalizeCompanyCode(code)}`;
}

export function isPlatformCompany(company) {
  if (!company) return true;
  return company.is_platform_owner === true || company.company_code === PLATFORM_COMPANY_CODE;
}

export function configKeyForCompany(company) {
  if (isPlatformCompany(company)) return PLATFORM_CONFIG_KEY;
  return company.config_key || partnerConfigKey(company.company_code);
}

export function generateServiceKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(40));
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += chars[bytes[i] % chars.length];
  return `tlec_${out}`;
}

export function serviceKeyPrefix(key) {
  return String(key || '').slice(0, 14);
}

export function platformServiceKey() {
  try {
    return secrets.get('APP_SERVICE_API_KEY') || '';
  } catch (_) {
    return '';
  }
}

export async function findCompanyByCode(base44, code) {
  const normalized = normalizeCompanyCode(code);
  if (!normalized) return null;
  const rows = await base44.asServiceRole.entities.Company.filter({ company_code: normalized }, '-created_date', 1);
  return rows?.[0] || null;
}

export async function findCompanyByKey(base44, key) {
  const clean = String(key || '').trim();
  if (!clean) return null;
  const rows = await base44.asServiceRole.entities.Company.filter({ service_key: clean }, '-created_date', 1);
  return rows?.[0] || null;
}

export function clearCompanyCache(configKey) {
  if (configKey) configCache.delete(String(configKey));
  else configCache.clear();
}

export async function getPlatformConfig(base44) {
  const rows = await base44.asServiceRole.entities.AppConfig.filter({ config_key: PLATFORM_CONFIG_KEY }, '-updated_date', 1);
  return rows?.[0] || null;
}

export async function getCompanyConfig(base44, company) {
  const configKey = configKeyForCompany(company);
  const cached = configCache.get(configKey);
  if (cached && Date.now() - cached.ts < CONFIG_CACHE_MS) return cached.value;
  const rows = await base44.asServiceRole.entities.AppConfig.filter({ config_key: configKey }, '-updated_date', 1);
  const value = rows?.[0] || null;
  configCache.set(configKey, { value, ts: Date.now() });
  return value;
}

export function companyBrandPatch(company) {
  const patch = {};
  if (!company) return patch;
  BRAND_SOURCE_FIELDS.forEach((field) => {
    if (field in company) patch[field] = company[field] || '';
  });
  if (!patch.app_name) patch.app_name = company.app_name || company.name || '';
  patch.invoice_company_name = company.invoice_company_name || company.legal_name || company.name || '';
  patch.invoice_logo_url = company.invoice_logo_url || company.app_logo_url || '';
  return patch;
}

// Crea la fila de configuración propia de la socia copiando la de TLEC como base.
export async function ensureCompanyConfig(base44, company) {
  const existing = await getCompanyConfig(base44, company);
  if (existing) return existing;
  const platform = await getPlatformConfig(base44);
  const row = { ...(platform || {}) };
  delete row.id;
  delete row.created_date;
  delete row.updated_date;
  delete row.created_by_id;
  const payload = {
    ...row,
    ...companyBrandPatch(company),
    config_key: configKeyForCompany(company),
    maintenance_mode: false,
    demo_mode: false,
  };
  const created = await base44.asServiceRole.entities.AppConfig.create(payload);
  clearCompanyCache(payload.config_key);
  return created;
}

export async function syncCompanyBrandToConfig(base44, company) {
  const row = await getCompanyConfig(base44, company);
  if (!row) return await ensureCompanyConfig(base44, company);
  const updated = await base44.asServiceRole.entities.AppConfig.update(row.id, companyBrandPatch(company));
  clearCompanyCache(configKeyForCompany(company));
  return updated;
}

export async function logCompanyUsage(base44, entry) {
  const payload = {
    company_code: entry?.company_code || PLATFORM_COMPANY_CODE,
    capability: entry?.capability || 'lectura',
    action: entry?.action || '',
    entity_name: entry?.entity_name || '',
    function_name: entry?.function_name || '',
    record_count: Number(entry?.record_count) || 0,
    actor_email: entry?.actor_email || '',
    actor_role: entry?.actor_role || '',
    success: entry?.success !== false,
    error_message: String(entry?.error_message || '').slice(0, 500),
    duration_ms: Number(entry?.duration_ms) || 0,
    source: entry?.source || 'canal_de_datos',
  };
  try {
    await base44.asServiceRole.entities.CompanyUsageLog.create(payload);
  } catch (_) {
    // el registro de consumo nunca debe romper la operación de la socia
  }
}

// Marca la última conexión de la llave (máximo una vez por minuto por empresa).
export async function touchServiceKeyUsage(base44, company) {
  if (!company?.id) return;
  const last = keyTouchCache.get(company.id) || 0;
  if (Date.now() - last < 60000) return;
  keyTouchCache.set(company.id, Date.now());
  try {
    await base44.asServiceRole.entities.Company.update(company.id, {
      service_key_last_used_date: new Date().toISOString(),
    });
  } catch (_) {}
}