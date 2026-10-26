import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { fetchAllFilter, errorMessage } from '../../shared/paginatedFetch.ts';

// =====================================================================
// Buscador de contenedor (N° de orden/envío de CbmIngreso).
//
// Devuelve todo lo que salió con ese contenedor, agrupado por cliente:
//   - recibos (CBM, fecha, trackings)
//   - facturas generadas con su estado de pago
//   - guías de despacho donde salió la carga
//   - bultos y cajas consolidadas que se despacharon con ese N°
// Filtro opcional por estado de factura. Solo admin.
// =====================================================================

const CHUNK = 100;

const key = (value: any) => String(value || '').trim().toUpperCase();
const num = (value: any) => (Number.isFinite(Number(value)) ? Number(value) : 0);

const bultoPackageCount = (bulto: any) => {
  const manual = num(bulto?.cargo_package_count);
  if (manual > 0) return manual;
  return (bulto?.package_ids || []).length + (bulto?.unregistered_codes || []).length;
};

const isPaid = (invoice: any) => {
  const total = num(invoice.total);
  const paid = num(invoice.paid_amount);
  return String(invoice.status || '') === 'pagada' || (total > 0 && paid >= total - 0.01);
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const container = String(body.container_number || '').trim();
    const statusFilter = String(body.invoice_status || '').trim();
    if (!container) return Response.json({ error: 'Indica el número de contenedor' }, { status: 400 });

    const svc = base44.asServiceRole.entities;

    // 1) Recibos de ese contenedor (N° de orden/envío).
    let receipts = await fetchAllFilter(svc.CbmIngreso, { invoice_number: container }, '-fecha');
    if (!receipts.length && Number.isFinite(Number(container))) {
      receipts = await fetchAllFilter(svc.CbmIngreso, { invoice_number: Number(container) }, '-fecha');
    }
    if (!receipts.length) {
      return Response.json({
        container,
        invoice_status: statusFilter,
        clients: [],
        totals: { clients: 0, receipts: 0, cbm: 0, packages: 0, invoices: 0, paid_invoices: 0, guides: 0, bultos: 0, cajas: 0 },
      });
    }

    const clientEmails = [...new Set(receipts.map((r: any) => String(r.client_email || '').trim()).filter(Boolean))];
    const receiptIds = new Set(receipts.map((r: any) => String(r.id)));
    const trackings = [...new Set(
      receipts.flatMap((r: any) => (r.tracking_numbers || []).map((t: any) => String(t).trim()))
    )].filter(Boolean);

    // 2) Facturas del contenedor: las ligadas a sus recibos o a su N° de orden.
    const invoiceMap = new Map<string, any>();
    if (clientEmails.length) {
      const invoices = await fetchAllFilter(svc.Invoice, { client_email: { $in: clientEmails } }, '-invoice_date');
      for (const invoice of invoices) {
        const links = (invoice as any).manual_recibos || [];
        const linked = links.some((link: any) => receiptIds.has(String(link.cbm_ingreso_id || '')))
          || links.some((link: any) => key(link.invoice_number) === key(container));
        if (linked) invoiceMap.set(String((invoice as any).id), invoice);
      }
    }
    const referenced = [...new Set(
      receipts.map((r: any) => String(r.billed_invoice_id || '').trim()).filter((id) => id && !invoiceMap.has(id))
    )];
    for (let i = 0; i < referenced.length; i += CHUNK) {
      const found = await fetchAllFilter(svc.Invoice, { id: { $in: referenced.slice(i, i + CHUNK) } }, '-invoice_date');
      for (const invoice of found) invoiceMap.set(String((invoice as any).id), invoice);
    }

    // 3) Bultos y cajas consolidadas despachadas con ese contenedor.
    const bultoMap = new Map<string, any>();
    const addBultos = (list: any[]) => {
      for (const bulto of list) {
        const id = String(bulto?.id || '');
        if (id) bultoMap.set(id, bulto);
      }
    };
    addBultos(await fetchAllFilter(svc.Bulto, { cbm_order_numbers: container }, '-created_date'));
    for (let i = 0; i < trackings.length; i += CHUNK) {
      addBultos(await fetchAllFilter(svc.Bulto, { package_trackings: { $in: trackings.slice(i, i + CHUNK) } }, '-created_date'));
    }

    // 4) Guías de despacho: por etiquetas de esos bultos y por las líneas del N° de orden.
    const labels = [...new Set(
      [...bultoMap.values()].map((bulto: any) => String(bulto.label_code || '').trim()).filter(Boolean)
    )];
    const guideMap = new Map<string, any>();
    const addGuides = (list: any[]) => {
      for (const guide of list) {
        const id = String(guide?.id || '');
        if (id) guideMap.set(id, guide);
      }
    };
    for (let i = 0; i < labels.length; i += CHUNK) {
      addGuides(await fetchAllFilter(svc.DispatchGuide, { bulto_codes: { $in: labels.slice(i, i + CHUNK) } }, '-emitted_date'));
    }
    for (let i = 0; i < clientEmails.length; i += CHUNK) {
      addGuides(await fetchAllFilter(svc.DispatchGuide, { client_emails: { $in: clientEmails.slice(i, i + CHUNK) } }, '-emitted_date'));
    }

    const labelSet = new Set(labels.map(key));
    const containerKey = key(container);

    // 5) Agrupado por cliente.
    const clients = clientEmails.map((email) => {
      const mine = receipts.filter((r: any) => String(r.client_email || '').trim() === email);
      const first: any = mine[0] || {};
      const labelCodes = new Set(
        [...bultoMap.values()]
          .filter((bulto: any) => String(bulto.client_email || '').trim() === email)
          .map((bulto: any) => key(bulto.label_code))
      );

      const invoices = [...invoiceMap.values()]
        .filter((invoice: any) => String(invoice.client_email || '').trim() === email)
        .map((invoice: any) => ({
          id: invoice.id,
          invoice_number: invoice.invoice_number || '',
          status: invoice.status || 'pendiente',
          total: num(invoice.total),
          paid_amount: num(invoice.paid_amount),
          balance: Math.max(0, num(invoice.total) - num(invoice.paid_amount)),
          paid: isPaid(invoice),
          invoice_date: invoice.invoice_date || invoice.created_date || '',
          due_date: invoice.due_date || '',
        }))
        .sort((a, b) => String(b.invoice_date).localeCompare(String(a.invoice_date)));

      const guides = [...guideMap.values()]
        .map((guide: any) => {
          const clientSnapshots = ((guide.clients || []) as any[])
            .filter((snapshot: any) => key(snapshot.client_email) === key(email));
          const lines = clientSnapshots.flatMap((snapshot: any) => (snapshot.bultos || []))
            .filter((line: any) => {
              if (labelSet.has(key(line.label_code))) return true;
              if (key(line.label_code) && labelCodes.has(key(line.label_code))) return true;
              return key(line.order_number) === containerKey;
            });
          const keys = (guide.unregistered_order_keys || []).map(key);
          const viaUnregistered = keys.some((entry: string) => entry.endsWith(containerKey));
          if (!lines.length && !clientSnapshots.length) return null;
          if (!lines.length && !viaUnregistered) return null;
          return {
            id: guide.id,
            guide_number: guide.guide_number || '',
            emitted_date: guide.emitted_date || guide.created_date || '',
            dispatch_status: guide.dispatch_status || 'emitida',
            dispatched_on: guide.dispatch_due_completed_date || '',
            lines: lines.map((line: any) => ({
              label_code: line.label_code || '',
              is_caja: !!line.is_caja,
              caja_number: num(line.caja_number) || null,
              caja_total: num(line.caja_total) || null,
              package_count: num(line.package_count),
              order_number: line.order_number || '',
            })),
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => String(b.emitted_date).localeCompare(String(a.emitted_date)));

      const bultos = [...bultoMap.values()]
        .filter((bulto: any) => labelCodes.has(key(bulto.label_code)))
        .map((bulto: any) => ({
          id: bulto.id,
          label_code: bulto.label_code || '',
          is_caja: !!bulto.is_caja,
          bulto_number: num(bulto.bulto_number) || null,
          caja_number: num(bulto.caja_number) || null,
          caja_total: num(bulto.caja_total) || null,
          package_count: bultoPackageCount(bulto),
          cbm: num(bulto.cargo_cbm),
          status: bulto.status || '',
          description: bulto.description || '',
          trackings: (bulto.package_trackings || []).length,
        }))
        .sort((a, b) => String(a.label_code).localeCompare(String(b.label_code)));

      const cbm = mine.reduce((sum: number, r: any) => sum + num(r.cbm), 0);
      const packages = mine.reduce(
        (sum: number, r: any) => sum + (num(r.package_count) || (r.tracking_numbers || []).length),
        0,
      );

      return {
        client_email: email,
        client_name: String(first.client_name || '').trim(),
        shipping_mark: String(first.shipping_mark || '').trim(),
        fecha_creacion: mine.reduce(
          (earliest: string, r: any) => {
            const value = r.fecha || r.created_date || '';
            if (!value) return earliest;
            if (!earliest) return value;
            return String(value) < String(earliest) ? value : earliest;
          },
          '',
        ),
        cbm,
        packages,
        receipts: mine.map((r: any) => ({
          id: r.id,
          order_number: r.invoice_number || '',
          cbm: num(r.cbm),
          fecha: r.fecha || '',
          trackings: (r.tracking_numbers || []).length,
          provider: r.proveedor || '',
          billed_invoice_number: r.invoice_number || '',
        })),
        invoices,
        guides,
        bultos,
      };
    });

    const filtered = statusFilter
      ? clients
        .map((client) => ({ ...client, invoices: client.invoices.filter((invoice) => invoice.status === statusFilter) }))
        .filter((client) => client.invoices.length > 0)
      : clients;

    const totals = filtered.reduce((acc, client) => ({
      clients: acc.clients + 1,
      receipts: acc.receipts + client.receipts.length,
      cbm: acc.cbm + client.cbm,
      packages: acc.packages + client.packages,
      invoices: acc.invoices + client.invoices.length,
      paid_invoices: acc.paid_invoices + client.invoices.filter((invoice) => invoice.paid).length,
      guides: acc.guides + client.guides.length,
      bultos: acc.bultos + client.bultos.length,
      cajas: acc.cajas + client.bultos.filter((bulto) => bulto.is_caja).length,
    }), {
      clients: 0, receipts: 0, cbm: 0, packages: 0, invoices: 0, paid_invoices: 0, guides: 0, bultos: 0, cajas: 0,
    });

    return Response.json({
      container,
      invoice_status: statusFilter,
      clients: filtered.sort((a, b) => b.cbm - a.cbm),
      totals: { ...totals, cbm: Math.round(totals.cbm * 1000) / 1000 },
    });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
});