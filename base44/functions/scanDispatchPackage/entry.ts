import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo personal autorizado' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { tracking_number, action } = body;
    const mode = action || 'dispatch'; // 'lookup' | 'receive' | 'dispatch'
    const tracking = (tracking_number || '').trim();
    if (!tracking) return Response.json({ error: 'tracking_number requerido' }, { status: 400 });

    // Foto capturada automáticamente por el escáner al detectar el código
    const photoUrl = String(body?.package_image_url || '').trim();
    const photoUrls = Array.isArray(body?.package_image_urls)
      ? body.package_image_urls.map((u) => String(u || '').trim()).filter(Boolean)
      : [];
    const allPhotoUrls = photoUrls.length ? photoUrls : (photoUrl ? [photoUrl] : []);

    const matches = await base44.asServiceRole.entities.Package.filter({ tracking_number: tracking });
    const pkg = matches?.[0];
    if (!pkg) {
      return Response.json({ error: 'Paquete no encontrado en el sistema', not_found: true }, { status: 404 });
    }

    const previousStatus = pkg.status;

    const loadClient = async () => {
      try {
        const users = await base44.asServiceRole.entities.User.filter({ email: pkg.client_email });
        const c = users?.[0];
        return c ? {
          full_name: c.full_name,
          email: c.email,
          shipping_mark: c.shipping_mark,
          city: c.city,
          state: c.state,
          cedula: c.cedula,
          whatsapp: c.whatsapp,
          address: c.address
        } : null;
      } catch (_) { return null; }
    };

    // Carga el recibo: busca el número de orden (invoice_number) asignado en CbmIngreso
    // (AdminCbmIngresos) usando el tracking del paquete. Si no se encuentra ahí,
    // usa consolidation_tracking de la consolidación como fallback.
    const loadConsolidationTracking = async () => {
      try {
        if (pkg.client_email) {
          const ingresos = await base44.asServiceRole.entities.CbmIngreso.filter({ client_email: pkg.client_email }, '-fecha', 200);
          const match = ingresos?.find((ing) => Array.isArray(ing.tracking_numbers) && ing.tracking_numbers.some(t => String(t).trim() === tracking));
          if (match?.invoice_number) return String(match.invoice_number).trim();
        }
      } catch (_) {}
      if (!pkg.consolidation_id) return '';
      try {
        const cons = await base44.asServiceRole.entities.Consolidation.get(pkg.consolidation_id);
        return cons?.consolidation_tracking || '';
      } catch (_) { return ''; }
    };

    // Busca si el recibo (consolidación) ya tiene una factura pagada,
    // buscando por consolidation_tracking o por consolidation_id.
    const loadPaidInvoice = async (consolidationTracking, consolidationId) => {
      try {
        const ct = (consolidationTracking || '').trim();
        if (ct) {
          const invs = await base44.asServiceRole.entities.Invoice.filter({ consolidation_tracking: ct });
          const paid = invs?.find((i) => i.status === 'pagada');
          if (paid) return { recibo_pagado: true, invoice_number: paid.invoice_number || '', invoice_id: paid.id };
        }
        if (consolidationId) {
          const invs = await base44.asServiceRole.entities.Invoice.filter({ consolidation_id: consolidationId });
          const paid = invs?.find((i) => i.status === 'pagada');
          if (paid) return { recibo_pagado: true, invoice_number: paid.invoice_number || '', invoice_id: paid.id };
        }
      } catch (_) {}
      return { recibo_pagado: false, invoice_number: '', invoice_id: '' };
    };

    // Solo consultar: no modifica nada, permite decidir manualmente
    if (mode === 'lookup') {
      const c = await loadClient();
      const consolidation_tracking = await loadConsolidationTracking();
      const paidInvoice = await loadPaidInvoice(consolidation_tracking, pkg.consolidation_id);
      return Response.json({
        success: true,
        ...paidInvoice,
        mode: 'lookup',
        already_dispatched: previousStatus === 'despachado',
        is_received: previousStatus !== 'pre_alerta',
        auto_received: false,
        previous_status: previousStatus,
        package: {
          id: pkg.id,
          tracking_number: pkg.tracking_number,
          description: pkg.description,
          shipping_type: pkg.shipping_type,
          client_email: pkg.client_email,
          shipping_mark: pkg.shipping_mark || c?.shipping_mark,
          dispatched_date: pkg.dispatched_date,
          consolidation_id: pkg.consolidation_id || '',
          consolidation_tracking
        },
        client: c
      });
    }

    // Marcar como recibido únicamente
    if (mode === 'receive') {
      const nowR = new Date().toISOString();
      const updateData = {};
      if (previousStatus === 'pre_alerta') {
        updateData.status = 'recibido';
        updateData.received_date = nowR;
        updateData.received_by = user.email;
      }
      if (allPhotoUrls.length) {
        updateData.package_image_url = allPhotoUrls[0];
        updateData.package_image_urls = allPhotoUrls;
      }
      if (Object.keys(updateData).length) {
        await base44.asServiceRole.entities.Package.update(pkg.id, updateData);
      }
      const c = await loadClient();
      const consolidation_tracking = await loadConsolidationTracking();
      const paidInvoice = await loadPaidInvoice(consolidation_tracking, pkg.consolidation_id);
      return Response.json({
        success: true,
        ...paidInvoice,
        mode: 'receive',
        already_dispatched: false,
        is_received: true,
        auto_received: previousStatus === 'pre_alerta',
        previous_status: previousStatus,
        package: {
          id: pkg.id,
          tracking_number: pkg.tracking_number,
          description: pkg.description,
          shipping_type: pkg.shipping_type,
          client_email: pkg.client_email,
          shipping_mark: pkg.shipping_mark || c?.shipping_mark,
          consolidation_id: pkg.consolidation_id || '',
          consolidation_tracking
        },
        client: c
      });
    }

    if (previousStatus === 'despachado') {
      // Ya fue despachado: solo informar, no volver a marcar
      let clientDup = null;
      try {
        const usersDup = await base44.asServiceRole.entities.User.filter({ email: pkg.client_email });
        clientDup = usersDup?.[0] || null;
      } catch (_) {}
      const consolidation_tracking = await loadConsolidationTracking();
      const paidInvoice = await loadPaidInvoice(consolidation_tracking, pkg.consolidation_id);
      return Response.json({
        success: true,
        ...paidInvoice,
        already_dispatched: true,
        auto_received: false,
        previous_status: previousStatus,
        package: {
          id: pkg.id,
          tracking_number: pkg.tracking_number,
          description: pkg.description,
          shipping_type: pkg.shipping_type,
          client_email: pkg.client_email,
          shipping_mark: pkg.shipping_mark,
          dispatched_date: pkg.dispatched_date,
          consolidation_id: pkg.consolidation_id || '',
          consolidation_tracking
        },
        client: clientDup ? {
          full_name: clientDup.full_name,
          email: clientDup.email,
          shipping_mark: clientDup.shipping_mark,
          city: clientDup.city,
          state: clientDup.state,
          cedula: clientDup.cedula,
          whatsapp: clientDup.whatsapp,
          address: clientDup.address
        } : null
      });
    }

    const now = new Date().toISOString();
    const autoReceived = previousStatus === 'pre_alerta';
    const updates = {
      status: 'despachado',
      dispatched_date: now,
      dispatched_by: user.email
    };
    if (autoReceived) {
      // No estaba recibido: se registra la recepción en este momento para que no quede pendiente
      updates.received_date = now;
      updates.received_by = user.email;
    }
    if (allPhotoUrls.length) {
      updates.package_image_url = allPhotoUrls[0];
      updates.package_image_urls = allPhotoUrls;
    }
    await base44.asServiceRole.entities.Package.update(pkg.id, updates);

    let client = null;
    try {
      const users = await base44.asServiceRole.entities.User.filter({ email: pkg.client_email });
      client = users?.[0] || null;
    } catch (_) {}

    const consolidation_tracking = await loadConsolidationTracking();
      const paidInvoice = await loadPaidInvoice(consolidation_tracking, pkg.consolidation_id);
    return Response.json({
      success: true,
      mode: 'dispatch',
      already_dispatched: false,
      is_received: true,
      auto_received: autoReceived,
      previous_status: previousStatus,
      package: {
        id: pkg.id,
        tracking_number: pkg.tracking_number,
        description: pkg.description,
        shipping_type: pkg.shipping_type,
        client_email: pkg.client_email,
        shipping_mark: pkg.shipping_mark || client?.shipping_mark,
        dispatched_date: now,
        consolidation_id: pkg.consolidation_id || '',
        consolidation_tracking
      },
      client: client ? {
        full_name: client.full_name,
        email: client.email,
        shipping_mark: client.shipping_mark,
        city: client.city,
        state: client.state,
        cedula: client.cedula,
        whatsapp: client.whatsapp,
        address: client.address
      } : null
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});