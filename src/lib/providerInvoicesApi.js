import { base44 } from '@/api/base44Client';
import { publicAppUrl } from '@/lib/publicLinks';
import { compressImageFile } from '@/lib/imageCompression';

// Cuando la pantalla se abre desde el enlace público del portal, cada llamada lleva su clave.
let portalToken = null;
export const setPortalToken = (t) => { portalToken = t || null; };

export async function piCall(action, payload = {}) {
  const res = await base44.functions.invoke('providerInvoices', { action, ...payload, ...(portalToken ? { portal_token: portalToken } : {}) });
  return res.data;
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export async function uploadToBunny(original) {
  const file = await compressImageFile(original);
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const base64 = await fileToBase64(file);
  const data = await piCall('upload', { base64, ext });
  return data.url;
}

// Fecha local del dispositivo en formato YYYY-MM-DD
export const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const portalUrl = (token) => publicAppUrl(`/PortalProveedor/${token}`);
export const publicInvoiceUrl = (token) => publicAppUrl(`/FacturaProveedor/${token}`);
export const money = (n) => `$${Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;