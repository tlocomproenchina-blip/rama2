import { base44 } from '@/api/base44Client';

// Configuración de la app con los datos de empresa que salen en la factura
export async function loadInvoiceConfig() {
  try {
    const configs = await base44.entities.AppConfig.filter({ config_key: 'main' });
    return configs.length > 0 ? configs[0] : {};
  } catch {
    return {};
  }
}

// Titular de la factura: el que se pase, o el usuario cliente del email facturado
export async function resolveInvoiceClient(invoice, user = null) {
  if (user) return user;
  if (!invoice?.client_email) return null;
  try {
    const res = await base44.functions.invoke('listAllUsers', { emails: [invoice.client_email] });
    return res?.data?.users?.[0] || null;
  } catch {
    return null;
  }
}

/**
 * Arma el PDF de la factura listo para ver o descargar.
 * @param {object} invoice - registro de factura
 * @param {object|null} user - usuario cliente ya resuelto (opcional)
 * @returns {Promise<import('jspdf').jsPDF>}
 */
export async function buildInvoiceDoc(invoice, user = null) {
  const [appConfig, clientUser] = await Promise.all([
    loadInvoiceConfig(),
    resolveInvoiceClient(invoice, user),
  ]);
  const { buildInvoicePdf } = await import('@/components/invoice/InvoicePdfBuilder');
  return buildInvoicePdf(invoice, appConfig, clientUser);
}