import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { sendBrevoEmail } from '../../shared/brevoEmail.ts';

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

    let pkg: any = null;
    let resolvedTracking = tracking;
    let autoCreatedFromLabel = false;

    // 1) Buscar por label_code (código de etiqueta TLEC) — coincidencia exacta
    const labelPkgMatches = await base44.asServiceRole.entities.Package.filter({ label_code: tracking });
    if (labelPkgMatches?.[0]) {
      pkg = labelPkgMatches[0];
    }

    // 2) Si no se encuentra por label_code, buscar por tracking_number
    //    (coincidencia exacta; si falla, prueba removiendo dígitos del final
    //     para sub-tracking: master + sufijo numérico, ej. S71332762881001 → S71332762881)
    if (!pkg) {
      const removalOrder = [0, 3, 2, 4, 1, 5, 6];
      for (const remove of removalOrder) {
        const candidate = remove === 0 ? tracking : (tracking.length - remove >= 5 ? tracking.slice(0, tracking.length - remove) : null);
        if (!candidate) continue;
        const matches = await base44.asServiceRole.entities.Package.filter({ tracking_number: candidate });
        if (matches?.[0]) {
          pkg = matches[0];
          resolvedTracking = candidate;
          break;
        }
      }
    }

    // 3) Si no se encuentra en Package, buscar en ShippingLabel y auto-crear pre-alerta
    if (!pkg) {
      const labels = await base44.asServiceRole.entities.ShippingLabel.filter({ label_code: tracking }, '-created_date', 1);
      const label = labels?.[0];
      if (label) {
        // Auto-crear pre-alerta desde los datos de la etiqueta (sin tracking del transportista aún)
        pkg = await base44.asServiceRole.entities.Package.create({
          tracking_number: '',
          client_email: label.client_email,
          shipping_mark: label.shipping_mark,
          label_code: label.label_code,
          shipping_type: 'maritimo',
          risk_category: (label.has_battery || label.has_liquid || label.has_powder || label.has_fbrand) ? 'alto_riesgo' : 'general',
          package_count: label.box_count || 1,
          description: label.content || 'Etiqueta TLEC',
          status: 'pre_alerta',
          is_orphan: false,
        });
        // Marcar etiqueta como vinculada
        try {
          await base44.asServiceRole.entities.ShippingLabel.update(label.id, {
            status: 'vinculada',
            linked_package_id: pkg.id
          });
        } catch (_) {}
        autoCreatedFromLabel = true;
      }
    }

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

    // Carga el recibo: busca el número de contenedor (invoice_number) asignado en CbmIngreso
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
        auto_created_from_label: autoCreatedFromLabel,
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

    // Crear/actualizar orden de despacho diaria agrupada por cliente
    // (los despachos individuales también deben aparecer en el historial)
    try {
      await base44.functions.invoke('createDispatchOrder', {
        client_email: pkg.client_email,
        client_name: client?.full_name || pkg.client_email,
        shipping_mark: pkg.shipping_mark || client?.shipping_mark || '',
        client_snapshot: client ? {
          full_name: client.full_name,
          email: client.email,
          cedula: client.cedula,
          whatsapp: client.whatsapp,
          address: client.address,
          city: client.city,
          state: client.state,
          shipping_mark: client.shipping_mark,
        } : {},
        items: [{
          tracking_number: pkg.tracking_number || '',
          description: pkg.description || '',
          consolidation_tracking: consolidation_tracking || '',
        }],
        created_by_email: user.email,
      });
    } catch (_) {}

    // Notificar al cliente: "Transportista asignado" (in-app + push vía workflow + email)
    try {
      const clientName = client?.full_name || (pkg.client_email ? pkg.client_email.split('@')[0] : 'Cliente');
      const displayTracking = pkg.tracking_number || '(sin tracking)';
      const notifTitle = '🚚 Transportista asignado';
      const notifMessage = `Tu paquete ${displayTracking} fue despachado del almacén. Un transportista fue asignado y tu envío va en camino.`;

      // 1. Notificación in-app (el push se dispara automáticamente vía workflow Broadcast Push)
      await base44.asServiceRole.entities.Notification.create({
        user_email: pkg.client_email,
        title: notifTitle,
        message: notifMessage,
        type: 'package',
        priority: 'normal',
        reference_id: pkg.id,
        entity_type: 'Package',
        icon: 'truck'
      });

      // 2. Email (respeta kill-switch global y modo demo)
      let cfg: any = null;
      try {
        const configs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
        cfg = configs?.[0];
      } catch (_) {}
      const emailsEnabled = cfg?.emails_enabled !== false;
      const demoMode = cfg?.demo_mode === true;
      if (emailsEnabled && !demoMode && pkg.client_email) {
        const emailBody =
          `<p>Hola <strong>${clientName}</strong>,</p>` +
          `<p>Te informamos que tu paquete <strong>${displayTracking}</strong> fue despachado de nuestro almacén.</p>` +
          `<p>🚚 <strong>Transportista asignado</strong>: tu envío va en camino a su destino.</p>` +
          `<p>Gracias por confiar en TLEC CARGO.</p>`;
        try {
          await sendBrevoEmail(base44, {
            to: pkg.client_email,
            subject: '🚚 Transportista asignado — tu paquete fue despachado',
            body: emailBody,
            from_name: 'TLEC CARGO',
            source: 'dispatch_assigned',
          });
        } catch (_) {}
      }
    } catch (_) {}

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