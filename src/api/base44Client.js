import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import {
  canBootstrapUserTenant,
  filterRecordsByTenant,
  getBootstrapFlagKey,
  injectTenantIntoData,
  mergeTenantIntoFunctionParams,
  persistTenantContext,
  resolveTenantContext,
  shouldIncludeRecordForTenant
} from '@/lib/tenantContext';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

const rawBase44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

const entityWrappers = new Map();
let tenantContextCache = null;
let tenantContextResolvedAt = 0;
const TENANT_CACHE_TTL_MS = 60 * 1000;

const setTenantCache = (context) => {
  tenantContextCache = context;
  tenantContextResolvedAt = Date.now();
  persistTenantContext(context);
};

const bootstrapUserTenant = (user, context) => {
  if (typeof window === 'undefined' || !canBootstrapUserTenant(user)) return;

  const flagKey = getBootstrapFlagKey(user.email);
  if (window.sessionStorage.getItem(flagKey)) return;

  window.sessionStorage.setItem(flagKey, '1');
  rawBase44.auth.updateMe({
    tenant_id: context.tenant_id,
    tenant_slug: context.tenant_slug,
    tenant_name: context.tenant_name
  }).catch(() => {
    window.sessionStorage.removeItem(flagKey);
  });
};

const getCurrentTenantContext = async () => {
  const now = Date.now();
  if (tenantContextCache && now - tenantContextResolvedAt < TENANT_CACHE_TTL_MS) {
    return tenantContextCache;
  }

  try {
    const user = await rawBase44.auth.me();
    const context = resolveTenantContext(user);
    setTenantCache(context);
    bootstrapUserTenant(user, context);
    return context;
  } catch {
    const context = resolveTenantContext(null);
    setTenantCache(context);
    return context;
  }
};

const createEntityWrapper = (entityName) => ({
  list: async (sortBy, limit, skip = 0) => {
    const context = await getCurrentTenantContext();
    const rows = await rawBase44.entities[entityName].list(sortBy, limit, skip);
    return filterRecordsByTenant(entityName, rows, context);
  },

  filter: async (query = {}, sortBy, limit, skip = 0) => {
    const context = await getCurrentTenantContext();
    const rows = await rawBase44.entities[entityName].filter(query, sortBy, limit, skip);
    return filterRecordsByTenant(entityName, rows, context);
  },

  get: async (id) => {
    const context = await getCurrentTenantContext();
    const record = await rawBase44.entities[entityName].get(id);

    if (!shouldIncludeRecordForTenant(entityName, record, context.tenant_id)) {
      throw new Error('Registro fuera del tenant activo');
    }

    return record;
  },

  create: async (data) => {
    const context = await getCurrentTenantContext();
    return await rawBase44.entities[entityName].create(injectTenantIntoData(entityName, data, context));
  },

  bulkCreate: async (dataArray = []) => {
    const context = await getCurrentTenantContext();
    return await rawBase44.entities[entityName].bulkCreate(
      dataArray.map((item) => injectTenantIntoData(entityName, item, context))
    );
  },

  update: async (id, data) => {
    const context = await getCurrentTenantContext();
    return await rawBase44.entities[entityName].update(id, injectTenantIntoData(entityName, data, context));
  },

  delete: async (id) => {
    const context = await getCurrentTenantContext();
    const record = await rawBase44.entities[entityName].get(id);

    if (!shouldIncludeRecordForTenant(entityName, record, context.tenant_id)) {
      throw new Error('Registro fuera del tenant activo');
    }

    return await rawBase44.entities[entityName].delete(id);
  },

  schema: async () => await rawBase44.entities[entityName].schema(),

  subscribe: (callback) => rawBase44.entities[entityName].subscribe(async (event) => {
    try {
      const context = await getCurrentTenantContext();
      if (event?.type === 'delete' || shouldIncludeRecordForTenant(entityName, event?.data, context.tenant_id)) {
        callback(event);
      }
    } catch {
      callback(event);
    }
  })
});

export const base44 = new Proxy(rawBase44, {
  get(target, prop) {
    if (prop === 'auth') {
      return {
        ...target.auth,
        me: async () => {
          const user = await rawBase44.auth.me();
          const context = resolveTenantContext(user);
          setTenantCache(context);
          bootstrapUserTenant(user, context);
          return user ? { ...user, ...context } : user;
        },
        updateMe: async (data) => {
          const user = await rawBase44.auth.updateMe(data);
          const context = resolveTenantContext(user || data);
          setTenantCache(context);
          return user ? { ...user, ...context } : user;
        },
        logout: (redirectUrl) => {
          tenantContextCache = null;
          tenantContextResolvedAt = 0;
          return rawBase44.auth.logout(redirectUrl);
        }
      };
    }

    if (prop === 'entities') {
      return new Proxy(target.entities, {
        get(entityTarget, entityName) {
          if (!entityWrappers.has(entityName)) {
            entityWrappers.set(entityName, createEntityWrapper(entityName));
          }
          return entityWrappers.get(entityName);
        }
      });
    }

    if (prop === 'functions') {
      return {
        ...target.functions,
        invoke: async (functionName, params) => {
          const context = await getCurrentTenantContext();
          return await rawBase44.functions.invoke(functionName, mergeTenantIntoFunctionParams(params, context));
        }
      };
    }

    return target[prop];
  }
});

export { rawBase44 };