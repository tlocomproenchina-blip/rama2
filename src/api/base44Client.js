import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { compressUploadPayload } from '@/lib/imageCompression';
import { isImageFile, uploadFileToBunny } from '@/lib/bunnyFileUpload';

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
// (calidad equilibrada, mismas dimensiones) y se guarda en Bunny, nunca en el
// almacenamiento de Base44. Devuelve el enlace de Bunny tanto en file_url como en
// file_uri, así las pantallas que esperan uno u otro siguen funcionando. Los
// archivos que no son imágenes (PDF, Excel) siguen su camino normal.
// Las fotos en Bunny ya son un enlace directo: CreateFileSignedUrl las devuelve tal cual.
const UPLOAD_ENDPOINTS = ['UploadFile', 'UploadPrivateFile', 'UploadPublicFile'];
const isDirectUrl = (value) => /^https?:\/\//i.test(String(value || ''));
const rawIntegrations = base44.integrations;
const invokeFunction = (name, payload) => base44.functions.invoke(name, payload);
base44.integrations = new Proxy(rawIntegrations, {
  get(target, pkg) {
    const pkgObj = target[pkg];
    if (pkg !== 'Core' || !pkgObj) return pkgObj;
    return new Proxy(pkgObj, {
      get(coreTarget, endpoint) {
        const fn = coreTarget[endpoint];
        if (typeof fn !== 'function') return fn;
        if (endpoint === 'CreateFileSignedUrl') {
          return async (data) => (isDirectUrl(data?.file_uri) ? { signed_url: data.file_uri } : fn(data));
        }
        if (!UPLOAD_ENDPOINTS.includes(endpoint)) return fn;
        return async (data) => {
          const payload = await compressUploadPayload(data);
          if (isImageFile(payload?.file)) {
            const url = await uploadFileToBunny(payload.file, invokeFunction);
            return { file_url: url, file_uri: url };
          }
          return fn(payload);
        };
      },
    });
  },
});