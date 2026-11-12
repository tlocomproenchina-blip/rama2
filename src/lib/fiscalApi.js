import { base44 } from '@/api/base44Client';

// Todas las escrituras del módulo pasan por el backend, que valida y recalcula.
export async function fiscalCall(action, payload = {}) {
  const res = await base44.functions.invoke('fiscalInvoice', { action, ...payload });
  return res.data;
}