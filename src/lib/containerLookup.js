import { base44 } from '@/api/base44Client';

// Busca el N° de contenedor (factura del ingreso CBM) de los trackings de una unidad,
// con la misma regla que aplica el servidor al sincronizar. Sin conexión, o si tarda
// demasiado, devuelve [] para no frenar la impresión de la etiqueta.
export async function lookupContainerNumbers(clientEmail, trackings, timeoutMs = 4000) {
  const codes = (trackings || []).filter(Boolean);
  if (!clientEmail || codes.length === 0) return [];
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return [];

  const lookup = (async () => {
    const rows = await base44.entities.CbmIngreso.filter({ client_email: clientEmail }, '-fecha', 200);
    const set = new Set(codes);
    const found = [];
    for (const c of rows || []) {
      const tn = Array.isArray(c.tracking_numbers) ? c.tracking_numbers : [];
      if (c.invoice_number && tn.some((t) => set.has(t))) found.push(String(c.invoice_number));
    }
    return [...new Set(found)];
  })();

  const timeout = new Promise((resolve) => setTimeout(() => resolve([]), timeoutMs));
  return Promise.race([lookup, timeout]).catch(() => []);
}