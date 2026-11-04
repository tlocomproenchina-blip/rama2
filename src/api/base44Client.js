import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { compressUploadPayload } from '@/lib/imageCompression';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

// Toda imagen que se suba por las integraciones de archivos se comprime antes
// (calidad equilibrada, mismas dimensiones). Cubre todas las pantallas de la app.
const UPLOAD_ENDPOINTS = ['UploadFile', 'UploadPrivateFile', 'UploadPublicFile'];
const rawIntegrations = base44.integrations;
base44.integrations = new Proxy(rawIntegrations, {
  get(target, pkg) {
    const pkgObj = target[pkg];
    if (pkg !== 'Core' || !pkgObj) return pkgObj;
    return new Proxy(pkgObj, {
      get(coreTarget, endpoint) {
        const fn = coreTarget[endpoint];
        if (!UPLOAD_ENDPOINTS.includes(endpoint) || typeof fn !== 'function') return fn;
        return async (data) => fn(await compressUploadPayload(data));
      },
    });
  },
});