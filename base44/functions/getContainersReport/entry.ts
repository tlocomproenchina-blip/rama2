import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { fetchAllFilter, errorMessage } from '../../shared/paginatedFetch.ts';

// =====================================================================
// Informe administrativo de contenedores y bultos.
//
// Una fila por contenedor (N° de orden/envío de CbmIngreso) con:
//   - shipping mark del cliente
//   - nombre y apellido del cliente
//   - número de contenedor (factura)
//   - cantidad de bultos: las líneas de bulto (y caja consolidada) que salieron
//     en las guías de despacho (DispatchGuide) para ese N° de orden
//   - descripción: por cada bulto se usa su descripción registrada y, si no
//     tiene, se toma al azar la descripción de uno de sus productos
// Solo admin.
// =====================================================================

const CHUNK = 100;

const key = (value: any) => String(value || '').trim().toUpperCase();

const randInt = (max: number) => Math.floor(Math.random() * max);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const svc = base44.asServiceRole.entities;

    const receipts = await fetchAllFilter(svc.CbmIngreso, {}, '-fecha');
    const containers = receipts.filter((r: any) => String(r.invoice_number || '').trim());
    const containerSet = new Set(containers.map((r: any) => String(r.invoice_number).trim()));

    // Líneas de bulto de las guías de despacho por contenedor (N° de orden).
    const labelsPorContenedor = new Map<string, Set<string>>();
    const guides = await fetchAllFilter(svc.DispatchGuide, {}, '-emitted_date');
    for (const guide of guides) {
      for (const client of ((guide as any).clients || [])) {
        for (const line of (client.bultos || [])) {
          const container = String(line.order_number || '').trim();
          const labelCode = String(line.label_code || '').trim();
          if (!labelCode || !containerSet.has(container)) continue;
          const bucket = labelsPorContenedor.get(container) || new Set<string>();
          bucket.add(key(labelCode));
          labelsPorContenedor.set(container, bucket);
        }
      }
    }

    // Bultos por etiqueta: descripción propia y trackings de sus productos.
    const allLabels = [...new Set([...labelsPorContenedor.values()].flatMap((set) => [...set]))];
    const bultoPorLabel = new Map<string, any>();
    for (let i = 0; i < allLabels.length; i += CHUNK) {
      const chunk = allLabels.slice(i, i + CHUNK);
      const bultos = await fetchAllFilter(svc.Bulto, { label_code: { $in: chunk } }, '-created_date');
      for (const bulto of bultos) {
        const label = key((bulto as any).label_code);
        if (!bultoPorLabel.has(label)) bultoPorLabel.set(label, bulto);
      }
    }

    // Descripciones de los productos de cada bulto.
    const allTrackings = [...new Set(
      [...bultoPorLabel.values()].flatMap((bulto: any) => (bulto.package_trackings || []).map(key))
    )];
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

    // Descripción de un bulto: la registrada o, si no tiene, una de sus
    // productos elegida al azar.
    const descripcionDeBulto = (label: string): string => {
      const bulto: any = bultoPorLabel.get(label);
      const propia = String(bulto?.description || '').trim();
      if (propia) return propia;
      const opciones = [...new Set(
        (bulto?.package_trackings || [])
          .map((tracking: any) => descripcionPorTracking.get(key(tracking)))
          .filter(Boolean)
      )];
      if (!opciones.length) return '';
      return opciones[randInt(opciones.length)];
    };

    const rows = containers.map((receipt: any) => {
      const container = String(receipt.invoice_number).trim();
      const fullName = String(receipt.client_name || '').trim();
      const parts = fullName.split(/\s+/).filter(Boolean);
      const firstName = parts.shift() || '';

      const labels = [...(labelsPorContenedor.get(container) || new Set<string>())].sort();
      const descripciones = [...new Set(labels.map(descripcionDeBulto).filter(Boolean))].slice(0, 10);
      const description = String(receipt.descripcion || '').trim() || descripciones.join(' · ');

      return {
        container,
        shipping_mark: String(receipt.shipping_mark || '').trim(),
        first_name: firstName,
        last_name: parts.join(' '),
        client_email: String(receipt.client_email || '').trim(),
        bultos: labels.length,
        description,
        date: receipt.fecha || receipt.fecha_salida || '',
      };
    }).sort((a: any, b: any) => String(b.date || '').localeCompare(String(a.date || '')));

    return Response.json({ rows, total: rows.length });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
});