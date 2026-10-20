import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { fetchAllFilter, errorMessage } from '../../shared/paginatedFetch.ts';

// =====================================================================
// Informe administrativo de contenedores y bultos.
//
// Una fila por contenedor (N° de orden/envío de CbmIngreso) con:
//   - shipping mark del cliente
//   - nombre y apellido del cliente
//   - número de contenedor (factura)
//   - cantidad de bultos registrados en almacén para ese contenedor
//   - descripción registrada (la del envío o, si no tiene, la de sus paquetes)
// Solo admin.
// =====================================================================

const CHUNK = 100;

const key = (value: any) => String(value || '').trim().toUpperCase();

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const svc = base44.asServiceRole.entities;

    const receipts = await fetchAllFilter(svc.CbmIngreso, {}, '-fecha');
    const containers = receipts.filter((r: any) => String(r.invoice_number || '').trim());
    const orderNumbers: string[] = [...new Set(containers.map((r: any) => String(r.invoice_number).trim()))];

    // Bultos registrados en almacén por contenedor (Bulto.cbm_order_numbers).
    const bultosPorContenedor = new Map<string, number>();
    const trackingsPorContenedor = new Map<string, Set<string>>();
    for (let i = 0; i < orderNumbers.length; i += CHUNK) {
      const chunk = orderNumbers.slice(i, i + CHUNK);
      const bultos = await fetchAllFilter(svc.Bulto, { cbm_order_numbers: { $in: chunk } }, '-created_date');
      for (const bulto of bultos) {
        const trackings: string[] = (bulto as any).package_trackings || [];
        for (const orderNumber of ((bulto as any).cbm_order_numbers || [])) {
          const container = String(orderNumber || '').trim();
          if (!chunk.includes(container)) continue;
          bultosPorContenedor.set(container, (bultosPorContenedor.get(container) || 0) + 1);
          const bucket = trackingsPorContenedor.get(container) || new Set<string>();
          trackings.forEach((tracking) => bucket.add(key(tracking)));
          trackingsPorContenedor.set(container, bucket);
        }
      }
    }

    // Descripción registrada de los paquetes de cada contenedor (respaldo cuando
    // el envío no trae descripción propia).
    const allTrackings = [...new Set([...trackingsPorContenedor.values()].flatMap((set) => [...set]))];
    const descripcionPorTracking = new Map<string, string>();
    for (let i = 0; i < allTrackings.length; i += CHUNK) {
      const chunk = allTrackings.slice(i, i + CHUNK);
      const paquetes = await fetchAllFilter(svc.Package, { tracking_number: { $in: chunk } }, '-created_date');
      for (const paquete of paquetes) {
        const description = String((paquete as any).description || '').trim();
        if (!description) continue;
        descripcionPorTracking.set(key((paquete as any).tracking_number), description);
      }
    }

    const rows = containers.map((receipt: any) => {
      const container = String(receipt.invoice_number).trim();
      const fullName = String(receipt.client_name || '').trim();
      const parts = fullName.split(/\s+/).filter(Boolean);
      const firstName = parts.shift() || '';

      const trackings = trackingsPorContenedor.get(container) || new Set<string>();
      const packageDescriptions = [...new Set(
        [...trackings].map((tracking) => descripcionPorTracking.get(tracking)).filter(Boolean)
      )];
      const description = String(receipt.descripcion || '').trim() || packageDescriptions.slice(0, 10).join(' · ');

      return {
        container,
        shipping_mark: String(receipt.shipping_mark || '').trim(),
        first_name: firstName,
        last_name: parts.join(' '),
        client_email: String(receipt.client_email || '').trim(),
        bultos: bultosPorContenedor.get(container) || 0,
        description,
        date: receipt.fecha || receipt.fecha_salida || '',
      };
    }).sort((a: any, b: any) => String(b.date || '').localeCompare(String(a.date || '')));

    return Response.json({ rows, total: rows.length });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
});