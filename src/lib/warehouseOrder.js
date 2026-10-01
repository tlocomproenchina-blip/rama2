import { base44 } from '@/components/api/ApiQueueManager';

// Genera (o regenera) la orden de almacén de una factura pagada y la guarda dentro
// de la factura. Devuelve { order } o { empty: true } cuando la factura no tiene
// bultos vinculados.
export async function generateWarehouseOrder(invoiceId) {
  const res = await base44.functions.invoke(
    'generateWarehouseOrder',
    { invoice_id: invoiceId },
    { opType: 'write', priority: 'HIGH' }
  );
  return res?.data || {};
}