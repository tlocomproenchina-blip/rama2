import { base44 } from '@/api/base44Client';

export async function piCall(action, payload = {}) {
  const res = await base44.functions.invoke('providerInvoices', { action, ...payload });
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

export async function uploadToBunny(file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const base64 = await fileToBase64(file);
  const data = await piCall('upload', { base64, ext });
  return data.url;
}

export const publicInvoiceUrl = (token) => `${window.location.origin}/FacturaProveedor/${token}`;
export const money = (n) => `$${Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;