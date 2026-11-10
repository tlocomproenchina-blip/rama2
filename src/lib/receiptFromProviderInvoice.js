import { base44 } from '@/components/api/ApiQueueManager';

export const normCode = (v) => String(v || '').trim().toUpperCase();

const addDays = (ymd, days) => {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

// Datos imprescindibles que faltan para registrar el recibo desde la factura de proveedor.
export function missingReceiptFields(pi, client) {
  const missing = [];
  if (!String(pi?.invoice_code || '').trim()) missing.push('N° de factura (contenedor)');
  if (!(Number(pi?.cbm) > 0)) missing.push('CBM');
  if (!(pi?.client_email || client?.email)) missing.push('email del cliente');
  return missing;
}

// Crea el recibo (CbmIngreso) con el mismo N° de la factura de proveedor, que es lo que los vincula.
// Antes revisa que el cliente no tenga ya un recibo con ese número para no duplicarlo.
export async function createReceiptFromProviderInvoice(pi, client) {
  const missing = missingReceiptFields(pi, client);
  if (missing.length) throw new Error(`Faltan datos: ${missing.join(', ')}.`);

  const email = pi.client_email || client.email;
  const code = String(pi.invoice_code).trim();
  const existing = await base44.entities.CbmIngreso.filter({ client_email: email, invoice_number: code }, '-fecha', 1);
  if (existing?.length) throw new Error(`El cliente ya tiene el recibo ${code}; la factura ya está vinculada.`);

  const loadDate = pi.load_date || new Date().toISOString().slice(0, 10);
  return base44.entities.CbmIngreso.create({
    fecha: `${loadDate}T12:00:00.000Z`,
    mes: loadDate.slice(0, 7),
    cbm: Number(pi.cbm),
    invoice_number: code,
    client_email: email,
    client_name: pi.client_name || client?.full_name || '',
    shipping_mark: pi.shipping_mark || client?.shipping_mark || '',
    tracking_numbers: [],
    proveedor: 'Factura de proveedor',
    fecha_salida: loadDate,
    fecha_estimada_llegada: addDays(loadDate, 90),
    notas: `Creado desde la factura de proveedor ${code}`,
    billed: false,
  });
}