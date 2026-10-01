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

    // Regla única de carga en almacén (Venezuela): todo bulto con paquetes que
    // todavía no fue despachado y no tiene factura viva. El estado solo se usa para
    // excluir lo ya despachado, así ningún bulto del almacén queda invisible.
    const [bultosCandidatos, receiptsBilledPending] = await Promise.all([
      fetchAllFilter(svc.Bulto, { status: { $ne: 'despachado' } }, '-created_date'),
      fetchAllFilter(svc.CbmIngreso, { billed: false }, '-fecha'),
    ]);

    // Marca manual desde el panel de Facturación Manual: ese bulto (y su N° de
    // orden/envío) ya se facturó por fuera, así que su recibo de CBM ya no se
    // ofrece (para no cobrarlo dos veces). El bulto sí sigue visible, marcado.
    const markedOrders = new Set<string>();
    for (const b of bultosCandidatos) {
      if ((b as any).billing_marked !== true) continue;
      for (const o of ((b as any).cbm_order_numbers || [])) {
        const key = String(o).trim();
        if (key) markedOrders.add(key);
      }
    }
    // Un envío/recibo marcado a mano como ya facturado (Facturación Manual) tampoco
    // se ofrece aquí como pendiente: se conserva, pero ya no está por facturar.
    const receiptsPending = receiptsBilledPending.filter(
      (r: any) => (r as any).billing_marked !== true && !markedOrders.has(String(r.invoice_number || '').trim())
    );

    // Auto-sanación: si la factura que marcó el bulto ya no existe, vuelve a ofrecerse.
    const invoiceIds = [...new Set(bultosCandidatos.map((b: any) => b.billed_invoice_id).filter(Boolean))] as string[];
    const aliveInvoiceIds = new Set<string>();
    for (let i = 0; i < invoiceIds.length; i += BATCH) {
      const found = await svc.Invoice.filter({ id: { $in: invoiceIds.slice(i, i + BATCH) } }, undefined, BATCH + 10).catch(() => []);
      for (const inv of found || []) aliveInvoiceIds.add(inv.id);
    }
    // El bulto marcado a mano como facturado NO se oculta de la lista: sigue visible
    // (marcado en verde) para poder deshacer la marca. Solo se excluye lo que ya
    // tiene una factura viva.
    let bultos = bultosCandidatos.filter((b: any) =>
      !b.billed_invoice_id || !aliveInvoiceIds.has(b.billed_invoice_id)
    );

    const clientEmails = [...new Set([
      ...bultos.map((b: any) => b.client_email),
      ...receiptsPending.map((r: any) => r.client_email),
    ].filter(Boolean))] as string[];

    if (clientEmails.length === 0) {
      return Response.json({ clients: [], total: 0, generated_at: new Date().toISOString() });
    }

    const [packages, ingresos, approvedInsurance, dispatchOrders] = await Promise.all([
      fetchByClientEmails(svc.Package, clientEmails, '-created_date'),
      fetchByClientEmails(svc.CbmIngreso, clientEmails, '-fecha'),
      fetchByClientEmails(svc.InsurancePayment, clientEmails, '-created_date', { status: 'aprobado' }),
      fetchByClientEmails(svc.DispatchOrder, clientEmails, '-created_date'),
    ]);

    // La carga que ya está dentro de una orden de despacho vigente no se vuelve a
    // ofrecer como almacén: fue asignada al cliente (facturada o en camino).
    const trackingsEnOrden = new Set<string>();
    for (const o of dispatchOrders || []) {
      if (o.status === 'cancelada') continue;
      for (const it of (o.items || [])) {
        const key = normTracking(it.tracking_number);
        if (key) trackingsEnOrden.add(key);
      }
    }
    bultos = bultos.filter((b: any) =>
      !(b.package_trackings || []).some((t: any) => trackingsEnOrden.has(normTracking(t)))
    );

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
        // Tipo de carga del bulto: alto riesgo si alguno de sus paquetes lo es.
        // El admin puede sobrescribirlo al registrar la tarifa (cargo_risk_category).
        let detectedRisk = 'general';
        for (const t of trackings) {
          if (pkgByTracking.get(t)?.risk_category === 'alto_riesgo') { detectedRisk = 'alto_riesgo'; break; }
        }
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
        // Fecha real de reconocimiento en el almacén de Venezuela: la que dejó el
        // escaneo de la etiqueta, o la del N° de orden asignado desde la pantalla
        // de escaneo. Si no hay escaneo, la fecha de registro del bulto se ofrece
        // aparte, etiquetada como aproximada.
        const veScanDate = b.ve_recognized_date || b.order_assigned_date || null;
        const veScanBy = b.ve_recognized_by || b.order_assigned_by || '';
        return {
          id: b.id,
          type: 'bulto',
          label: b.label_code || '',
          ve_recognized_date: veScanDate,
          ve_recognized_by: veScanDate ? veScanBy : '',
          ve_registered_date: b.created_date || null,
          ve_date_source: veScanDate ? 'escaneo' : (b.created_date ? 'registro' : null),
          bulto_number: b.bulto_number ?? null,
          order_numbers: (b.cbm_order_numbers || []).filter(Boolean),
          fecha: dates.length > 0 ? dates[dates.length - 1] : (b.created_date || null),
          cbm: registeredCbm > 0 ? registeredCbm : (cbmFromPackages > 0 ? cbmFromPackages : cbmFromReceipts),
          cbm_from_packages: registeredCbm > 0 ? true : cbmFromPackages > 0,
          cbm_manual: registeredCbm > 0,
          trackings,
          package_count: registeredCount > 0
            ? Math.round(registeredCount)
            : (((b.package_ids || []).length + (b.unregistered_codes || []).length) || trackings.length),
          package_count_manual: registeredCount > 0,
          // Tarifa registrada del bulto desde 'Carga en almacén': la factura la usa tal cual.
          // Marca manual de facturado: el bulto permanece en la lista, en verde,
          // y la marca se puede quitar desde la misma casilla.
          billing_marked: b.billing_marked === true,
          billing_marked_by: b.billing_marked_by || '',
          billing_marked_date: b.billing_marked_date || null,
          risk_category: detectedRisk,
          cargo_risk_category: b.cargo_risk_category || null,
          cargo_amount: num(b.cargo_amount),
          cargo_rate_per_cbm: num(b.cargo_rate_per_cbm),
          cargo_rate_kind: b.cargo_rate_kind || null,
        };
      });

      // Bulto que ya contiene cada tracking y cada N° de orden: permite decir en qué
      // bulto está cada recibo y con qué fecha se reconoció.
      const bultoByTracking = new Map<string, any>();
      const bultoByOrder = new Map<string, any>();
      for (const b of clientBultos) {
        for (const t of b.trackings) {
          if (!bultoByTracking.has(t)) bultoByTracking.set(t, b);
        }
        for (const o of (b.order_numbers || [])) {
          const key = String(o).trim();
          if (key && !bultoByOrder.has(key)) bultoByOrder.set(key, b);
        }
      }

      const clientReceipts = receiptsPending
        .filter((r: any) => r.client_email === email)
        .map((r: any) => {
          const trackings = [...new Set<string>(
            (r.tracking_numbers || []).map(normTracking).filter(Boolean)
          )];
          const ownerBulto = trackings.map((t) => bultoByTracking.get(t)).find(Boolean)
            || (r.invoice_number ? bultoByOrder.get(String(r.invoice_number).trim()) : null);
          return {
            id: r.id,
            type: 'receipt',
            label: r.invoice_number || r.descripcion || '—',
            fecha: r.fecha || null,
            cbm: num(r.cbm),
            trackings,
            package_count: trackings.length,
            overlap_bulto: !!ownerBulto,
            in_bulto: ownerBulto?.label || null,
            ve_date: ownerBulto?.ve_recognized_date || ownerBulto?.ve_registered_date || null,
            ve_date_source: ownerBulto?.ve_date_source || null,
          };
        });

      // El panel es la cola de facturación de la carga que está físicamente en el
      // almacén: solo se listan clientes con al menos un bulto en almacén. Los recibos
      // de CBM de quien no tiene bulto aquí no se tocan ni se borran: siguen
      // facturándose cuando el cliente se carga desde el buscador.
      if (clientBultos.length === 0) continue;

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