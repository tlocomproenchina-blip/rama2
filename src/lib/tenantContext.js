export const DEFAULT_TENANT_ID = 'legacy-default';
export const DEFAULT_TENANT_SLUG = 'tlec-cargo';
export const DEFAULT_TENANT_NAME = 'TLEC CARGO';

const STORAGE_KEY = 'app:tenant-context';
const BOOTSTRAP_PREFIX = 'app:tenant-bootstrap:';

export const TENANT_SCOPED_ENTITIES = new Set([
  'User',
  'AppConfig',
  'RoleConfig',
  'WarehouseLocation',
  'Package',
  'Warehouse',
  'Consolidation',
  'Notification',
  'SupportTicket',
  'ClientNote',
  'FAQ',
  'Invoice',
  'Promotion',
  'MarketingCampaign',
  'ConsolidationRequest',
  'EmailLog',
  'EmailTemplate',
  'PricingConfig',
  'StateConfig',
  'PrivacyConfig',
  'AccountsPayable',
  'AccountsPayableLedger',
  'ShippingProvider',
  'ProviderPayment',
  'ProviderPaymentLedger',
  'KnowledgeBase',
  'ErrorLog',
  'ClientExportHistory',
  'ReferralSettings',
  'ReferralCbmReward',
  'CreditsLedger',
  'BlogPost',
  'AssistedPaymentRequest',
  'RuntimeMetrics',
  'RuntimeTuning',
  'EmailQueue'
]);

export const isTenantScopedEntity = (entityName) => TENANT_SCOPED_ENTITIES.has(String(entityName));

export const getFallbackTenantContext = () => ({
  tenant_id: DEFAULT_TENANT_ID,
  tenant_slug: DEFAULT_TENANT_SLUG,
  tenant_name: DEFAULT_TENANT_NAME
});

export const getStoredTenantContext = () => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const persistTenantContext = (context) => {
  if (typeof window === 'undefined' || !context?.tenant_id) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(context));
  } catch {}
};

export const resolveTenantContext = (user) => {
  const fallback = getFallbackTenantContext();
  const stored = getStoredTenantContext();

  const context = {
    ...fallback,
    ...(stored || {}),
    ...(user?.tenant_id ? {
      tenant_id: user.tenant_id,
      tenant_slug: user.tenant_slug,
      tenant_name: user.tenant_name
    } : {})
  };

  persistTenantContext(context);
  return context;
};

export const canBootstrapUserTenant = (user) => Boolean(user?.email && !user?.tenant_id);

export const getBootstrapFlagKey = (email) => `${BOOTSTRAP_PREFIX}${email}`;

export const shouldIncludeRecordForTenant = (entityName, record, tenantId) => {
  if (!isTenantScopedEntity(entityName)) return true;
  if (!record) return false;

  if (record.tenant_id) {
    return record.tenant_id === tenantId;
  }

  return tenantId === DEFAULT_TENANT_ID;
};

export const filterRecordsByTenant = (entityName, records, context) => {
  if (!Array.isArray(records)) return records;
  if (!isTenantScopedEntity(entityName)) return records;

  return records.filter((record) => shouldIncludeRecordForTenant(entityName, record, context.tenant_id));
};

export const injectTenantIntoData = (entityName, data, context) => {
  if (!isTenantScopedEntity(entityName) || !data || Array.isArray(data)) return data;

  return {
    ...data,
    tenant_id: data.tenant_id || context.tenant_id
  };
};

export const mergeTenantIntoFunctionParams = (params, context) => ({
  ...(params || {}),
  __tenant: {
    tenant_id: context.tenant_id,
    tenant_slug: context.tenant_slug,
    tenant_name: context.tenant_name,
    ...(params?.__tenant || {})
  }
});