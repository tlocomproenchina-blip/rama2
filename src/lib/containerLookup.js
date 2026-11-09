import { base44 } from '@/api/base44Client';

const norm = (v) => String(v || '').trim().toUpperCase();

// Busca el N° de contenedor (factura del ingreso CBM) de los trackings de una unidad.
// Coincide sin importar mayúsculas ni espacios, y también encuentra el ingreso aunque
// esté cargado bajo otro email. Sin conexión, o si tarda demasiado, devuelve [] para
// no frenar la impresión de la etiqueta.
export async function lookupContainerNumbers(clientEmail, trackings, timeoutMs = 8000) {
  const codes = [...new Set((trackings || []).map((t) => String(t || '').trim()).filter(Boolean))];
  if (codes.length === 0) return [];
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return [];

  const lookup = (async () => {
    const [byClient, byTracking] = await Promise.all([
      clientEmail ? base44.entities.CbmIngreso.filter({ client_email: clientEmail }, '-fecha', 200) : [],
      base44.entities.CbmIngreso.filter({ tracking_numbers: { $in: codes } }, '-fecha', 50).catch(() => []),
    ]);
    const set = new Set(codes.map(norm));
    const found = [];
    for (const c of [...(byClient || []), ...(byTracking || [])]) {
      const tn = Array.isArray(c.tracking_numbers) ? c.tracking_numbers : [];
      if (c.invoice_number && tn.some((t) => set.has(norm(t)))) found.push(String(c.invoice_number));
    }
    return [...new Set(found)];
  })();

  const timeout = new Promise((resolve) => setTimeout(() => resolve([]), timeoutMs));
  return Promise.race([lookup, timeout]).catch(() => []);
}

// Antes de imprimir o reimprimir: completa el N° de contenedor de las unidades que
// no lo traen, para que la etiqueta siempre lo lleve cuando existe.
export async function withContainerNumbers(units) {
  return Promise.all((units || []).map(async (u) => {
    const has = Array.isArray(u?.cbm_order_numbers) && u.cbm_order_numbers.some(Boolean);
    if (has) return u;
    const orders = await lookupContainerNumbers(u?.client_email, u?.package_trackings);
    return orders.length ? { ...u, cbm_order_numbers: orders } : u;
  }));
}