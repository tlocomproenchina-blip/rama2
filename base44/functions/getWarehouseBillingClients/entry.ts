import { createClientFromRequest } from 'npm:@base44/sdk@0.8.51';
import { fetchAllFilter, fetchByClientEmails, num, normTracking, errorMessage, BATCH } from '../../shared/paginatedFetch.ts';

// =====================================================================
// Listado de carga pendiente de pago en el almacén de Venezuela.
//
// Combina dos fuentes:
//  1) Bultos con status 'en_almacen_ve' (inventario físico real) con su
//     N° de orden CbmIngreso y su CBM real (paquetes agrupados / recibo).
//  2) Recibos de CBM (CbmIngreso) pendientes de facturar (billed=false),
//     tal como los usa Facturación Manual.
//
// Solo admin. Los montos se calculan en el cliente con las mismas tarifas
// de Facturación Manual; aquí se entregan los datos y el FOB asegurado
// pendiente de cobro por tracking.
// =====================================================================

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const svc = base44.asServiceRole.entities;

    const [bultosVe, receiptsPending] = await Promise.all([
      fetchAllFilter(svc.Bulto, { status: 'en_almacen_ve' }, '-created_date'),
      fetchAllFilter(svc.CbmIngreso, { billed: false }, '-fecha'),
    ]);

    // Auto-sanación: si la factura que marcó el bulto ya no existe, vuelve a ofrecerse.
    const invoiceIds = [...new Set(bultosVe.map((b: any) => b.billed_invoice_id).filter(Boolean))] as string[];
    const aliveInvoiceIds = new Set<string>();
    for (let i = 0; i < invoiceIds.length; i += BATCH) {
      const found = await svc.Invoice.filter({ id: { $in: invoiceIds.slice(i, i + BATCH) } }, undefined, BATCH + 10).catch(() => []);
      for (const inv of found || []) aliveInvoiceIds.add(inv.id);
    }
    const bultos = bultosVe.filter((b: any) => !b.billed_invoice_id || !aliveInvoiceIds.has(b.billed_invoice_id));

    const clientEmails = [...new Set([
      ...bultos.map((b: any) => b.client_email),
      ...receiptsPending.map((r: any) => r.client_email),
    ].filter(Boolean))] as string[];

    if (clientEmails.length === 0) {
      return Response.json({ clients: [], total: 0, generated_at: new Date().toISOString() });
    }

    const [packages, ingresos, approvedInsurance] = await Promise.all([
      fetchByClientEmails(svc.Package, clientEmails, '-created_date'),
      fetchByClientEmails(svc.CbmIngreso, clientEmails, '-fecha'),
      fetchByClientEmails(svc.InsurancePayment, clientEmails, '-created_date', { status: 'aprobado' }),
    ]);

    const buckets: any = {};
    const bucketFor = (email: string) => {
      if (!buckets[email]) buckets[email] = { packages: [], ingresos: [], approved: [] };
      return buckets[email];
    };
    for (const p of packages) { if (p.client_email) bucketFor(p.client_email).packages.push(p); }
    for (const r of ingresos) { if (r.client_email) bucketFor(r.client_email).ingresos.push(r); }
    for (const ip of approvedInsurance) { if (ip.client_email) bucketFor(ip.client_email).approved.push(ip); }

    const clients: any[] = [];

    for (const email of clientEmails) {
      const bucket = buckets[email] || { packages: [], ingresos: [], approved: [] };

      const pkgByTracking = new Map<string, any>();
      for (const p of bucket.packages) {
        const key = normTracking(p.tracking_number);
        if (key && !pkgByTracking.has(key)) pkgByTracking.set(key, p);
      }

      const ingByTracking = new Map<string, any>();
      for (const r of bucket.ingresos) {
        for (const t of (r.tracking_numbers || [])) {
          const key = normTracking(t);
          if (key && !ingByTracking.has(key)) ingByTracking.set(key, r);
        }
      }

      const ingByOrder = new Map<string, any>();
      for (const r of bucket.ingresos) {
        const key = String(r.invoice_number || '').trim();
        if (key && !ingByOrder.has(key)) ingByOrder.set(key, r);
      }

      const approvedTrackings = new Set<string>(
        bucket.approved.map((ip: any) => normTracking(ip.tracking_number)).filter(Boolean)
      );

      // FOB asegurado pendiente de cobro por tracking (misma regla que Facturación Manual)
      const insuredFob: Record<string, number> = {};
      for (const p of bucket.packages) {
        if (!p.has_insurance) continue;
        const fob = num(p.fob_value);
        if (fob <= 0) continue;
        const trackings = String(p.tracking_number || '').split(/[，,;|]+/).map(normTracking).filter(Boolean);
        for (const t of trackings) {
          if (approvedTrackings.has(t)) continue;
          insuredFob[t] = Math.max(insuredFob[t] || 0, fob);
        }
      }

      const myBultosRaw = bultos.filter((b: any) => b.client_email === email);

      const clientBultos = myBultosRaw.map((b: any) => {
        const trackings = [...new Set<string>(
          (b.package_trackings || []).map(normTracking).filter(Boolean)
        )];
        let cbmFromPackages = 0;
        const linkedReceipts: any[] = [];
        const linkedIds = new Set<string>();
        for (const t of trackings) {
          const pkg = pkgByTracking.get(t);
          if (pkg) cbmFromPackages += num(pkg.actual_cbm);
          const ing = ingByTracking.get(t);
          if (ing && !linkedIds.has(ing.id)) { linkedIds.add(ing.id); linkedReceipts.push(ing); }
        }
        // Fallback por N° de orden: CBM del recibo asignado al bulto
        for (const order of (b.cbm_order_numbers || []).filter(Boolean)) {
          const ing = ingByOrder.get(String(order).trim());
          if (ing && !linkedIds.has(ing.id)) { linkedIds.add(ing.id); linkedReceipts.push(ing); }
        }

        const cbmFromReceipts = linkedReceipts.reduce((s, r) => s + num(r.cbm), 0);
        const dates = linkedReceipts.map((r) => r.fecha).filter(Boolean).sort();
        // CBM y cantidad de paquetes registrados a mano desde 'Carga en almacén' mandan
        // sobre lo deducido de los paquetes o del recibo.
        const registeredCbm = num(b.cargo_cbm);
        const registeredCount = num(b.cargo_package_count);
        return {
          id: b.id,
          type: 'bulto',
          label: b.label_code || '',
          bulto_number: b.bulto_number ?? null,
          order_numbers: (b.cbm_order_numbers || []).filter(Boolean),
          fecha: dates.length > 0 ? dates[dates.length - 1] : (b.created_date || null),
          cbm: registeredCbm > 0 ? registeredCbm : (cbmFromPackages > 0 ? cbmFromPackages : cbmFromReceipts),
          cbm_from_packages: registeredCbm > 0 ? true : cbmFromPackages > 0,
          cbm_manual: registeredCbm > 0,
          trackings,
          package_count: registeredCount > 0
            ? Math.round(registeredCount)
            : ((b.package_ids || []).length || trackings.length),
          package_count_manual: registeredCount > 0,
        };
      });

      const bultoTrackings = new Set<string>(clientBultos.flatMap((b: any) => b.trackings));
      const bultoOrders = new Set<string>(
        clientBultos.flatMap((b: any) => b.order_numbers || []).map((o: any) => String(o).trim())
      );

      const clientReceipts = receiptsPending
        .filter((r: any) => r.client_email === email)
        .map((r: any) => {
          const trackings = [...new Set<string>(
            (r.tracking_numbers || []).map(normTracking).filter(Boolean)
          )];
          return {
            id: r.id,
            type: 'receipt',
            label: r.invoice_number || r.descripcion || '—',
            fecha: r.fecha || null,
            cbm: num(r.cbm),
            trackings,
            package_count: trackings.length,
            overlap_bulto: trackings.some((t) => bultoTrackings.has(t))
              || (!!r.invoice_number && bultoOrders.has(String(r.invoice_number).trim())),
          };
        });

      if (clientBultos.length === 0 && clientReceipts.length === 0) continue;

      const snap = myBultosRaw.length > 0 ? (myBultosRaw[0].client_snapshot || {}) : {};

      clients.push({
        client_email: email,
        client_name: snap.full_name || '',
        shipping_mark: snap.shipping_mark || '',
        whatsapp: snap.whatsapp || '',
        cedula: snap.cedula || '',
        address: snap.address || '',
        city: snap.city || '',
        state: snap.state || '',
        registered: false,
        bultos: clientBultos,
        receipts: clientReceipts,
        insured_fob: insuredFob,
        totals: {
          cbm: clientBultos.reduce((s: number, b: any) => s + num(b.cbm), 0)
            + clientReceipts.reduce((s: number, r: any) => s + num(r.cbm), 0),
          packages: clientBultos.reduce((s: number, b: any) => s + num(b.package_count), 0)
            + clientReceipts.reduce((s: number, r: any) => s + num(r.package_count), 0),
          bultos: clientBultos.length,
          receipts: clientReceipts.length,
        },
      });
    }

    // Datos del cliente registrado (o el snapshot del bulto si no está registrado)
    if (clients.length > 0) {
      try {
        const res = await base44.asServiceRole.functions.invoke('getClientsByEmails', {
          emails: clients.map((c) => c.client_email),
        });
        const map = res?.clients || res?.data?.clients || {};
        for (const c of clients) {
          const u = map[c.client_email];
          if (!u) continue;
          c.registered = true;
          c.client_name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.full_name || c.client_name;
          c.shipping_mark = u.shipping_mark || c.shipping_mark;
          c.whatsapp = u.whatsapp || u.phone || c.whatsapp;
          c.cedula = u.cedula || c.cedula;
          c.address = u.address || c.address;
          c.city = u.city || c.city;
          c.state = u.state || c.state;
        }
      } catch (_) {
        // Enriquecimiento best-effort: el snapshot del bulto ya trae los datos básicos
      }
    }

    for (const c of clients) {
      if (!c.client_name) c.client_name = c.client_email;
    }

    clients.sort((a, b) => num(b.totals.cbm) - num(a.totals.cbm));

    return Response.json({ clients, total: clients.length, generated_at: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
});