import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Revisión de inventario al llegar un contenedor.
// action 'list': cajas/bultos del cliente con su contenido declarado y su última revisión.
// action 'review': registra la revisión; si no coincide crea la incidencia con foto.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const svc = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));

    if (body.action === 'list') {
      const email = String(body.client_email || '').trim();
      if (!email) return Response.json({ error: 'Falta el cliente' }, { status: 400 });
      const bultos = await svc.Bulto.filter({ client_email: email }, '-created_date', 300);
      const ids = [...new Set(bultos.flatMap((b: any) => b.package_ids || []))]
        .filter((id: any) => id && !String(id).startsWith('local_')).slice(0, 500) as string[];
      const pkgById: Record<string, any> = {};
      for (let i = 0; i < ids.length; i += 100) {
        const rows = await svc.Package.filter({ id: { $in: ids.slice(i, i + 100) } }, '-created_date', 100);
        for (const p of rows) pkgById[p.id] = p;
      }
      const reviews = bultos.length
        ? await svc.CajaInventoryReview.filter({ bulto_id: { $in: bultos.map((b: any) => b.id) } }, '-reviewed_date', 500)
        : [];
      const reviewByBulto: Record<string, any> = {};
      for (const r of reviews) if (!reviewByBulto[r.bulto_id]) reviewByBulto[r.bulto_id] = r;

      return Response.json({
        units: bultos.map((b: any) => ({
          id: b.id,
          label_code: b.label_code,
          is_caja: !!b.is_caja,
          status: b.status,
          order_numbers: b.cbm_order_numbers || [],
          package_count: b.cargo_package_count ?? ((b.package_ids || []).length + (b.unregistered_codes || []).length),
          packages: (b.package_ids || []).map((id: string) => pkgById[id]).filter(Boolean).map((p: any) => ({
            tracking: p.tracking_number,
            description: p.description || '',
            package_count: p.package_count || 1,
            fob_value: p.fob_value || null,
          })),
          unregistered_codes: b.unregistered_codes || [],
          review: reviewByBulto[b.id] || null,
        })),
      });
    }

    // ¿Ya existe una incidencia para este cliente + tracking?
    if (body.action === 'check_incident') {
      const tracking = String(body.tracking_number || '').trim();
      const email = String(body.client_email || '').trim();
      if (!tracking || !email) return Response.json({ exists: false });
      const found = await svc.WarehouseIncident.filter({ tracking_number: tracking, client_email: email }, '-reported_date', 1);
      if (!found[0]) return Response.json({ exists: false, incident: null });
      // Datos para consultar el registro existente y reimprimir la etiqueta de su unidad.
      const pkgs = await svc.Package.filter({ tracking_number: tracking }, '-created_date', 5);
      const ors: any[] = [{ package_trackings: tracking }];
      if (found[0].bulto_id) ors.push({ id: found[0].bulto_id });
      for (const p of pkgs) ors.push({ package_ids: p.id });
      const units = await svc.Bulto.filter({ $or: ors }, '-created_date', 5);
      const unit = units.find((u: any) => u.status !== 'desarmado') || null;
      const reviews = await svc.CajaInventoryReview.filter({ tracking_number: tracking }, '-reviewed_date', 1);
      return Response.json({ exists: true, incident: found[0], review: reviews[0] || null, bulto: unit });
    }

    // Revisión por paquete en la Mesa de empaque, antes de añadirlo a la unidad.
    if (body.action === 'package_review') {
      const key = String(body.review_key || '').trim();
      if (!key) return Response.json({ error: 'Falta la clave de revisión' }, { status: 400 });
      const prev = await svc.CajaInventoryReview.filter({ review_key: key }, '-reviewed_date', 1);
      if (prev[0]) return Response.json({ success: true, review: prev[0], duplicate: true });

      const tracking = String(body.tracking_number || '').trim();
      const pkgId = String(body.package_id || '');
      const pkg = pkgId && !pkgId.startsWith('local_') ? await svc.Package.get(pkgId).catch(() => null) : null;
      const email = pkg?.client_email || String(body.client_email || '');
      const clientName = String(body.client_name || '');
      const container = String(body.container_number || '').trim().toUpperCase();
      const notes = String(body.notes || '').trim().slice(0, 1000);
      const contentPhoto = String(body.content_photo_uri || '');
      const damagePhotos = (Array.isArray(body.damage_photo_uris) ? body.damage_photo_uris : []).filter(Boolean).slice(0, 10);
      const type = ['abierto', 'faltante', 'danado'].includes(body.incident_type) ? body.incident_type : '';
      const now = new Date().toISOString();
      const matches = !body.has_incident;
      if (!container) return Response.json({ error: 'Escribe el N° de contenedor.' }, { status: 400 });
      if (!contentPhoto) return Response.json({ error: 'La foto del contenido es obligatoria.' }, { status: 400 });
      let incidentId = '';
      if (!matches) {
        if (!type) return Response.json({ error: 'Elige el tipo de problema.' }, { status: 400 });
        if (!notes) return Response.json({ error: 'Describe la diferencia encontrada.' }, { status: 400 });
        if (tracking && email) {
          const dup = await svc.WarehouseIncident.filter({ tracking_number: tracking, client_email: email }, '-reported_date', 1);
          if (dup[0]) {
            const when = new Date(dup[0].reported_date || dup[0].created_date).toLocaleString('es-VE', { timeZone: 'America/Caracas' });
            return Response.json({ error: `Esta incidencia ya fue registrada anteriormente (tracking ${tracking}, ${when}).`, duplicate_incident: true }, { status: 409 });
          }
        }
        const inc = await svc.WarehouseIncident.create({
          package_id: pkg?.id || '',
          tracking_number: tracking,
          source: 'mesa_empaque',
          incident_type: type,
          photo_uris: damagePhotos.length ? damagePhotos : [contentPhoto],
          photo_uri: damagePhotos[0] || contentPhoto,
          container_number: container,
          client_code: String(pkg?.shipping_mark || body.shipping_mark || '').toUpperCase(),
          client_email: email,
          client_name: clientName,
          notes: `[${tracking}] ${notes}`,
          reported_date: now,
          reported_by: user.email,
          reported_by_name: user.full_name || '',
        });
        incidentId = inc.id;
      }
      const review = await svc.CajaInventoryReview.create({
        source: 'mesa_empaque',
        review_key: key,
        package_id: pkg?.id || '',
        tracking_number: tracking,
        label_code: String(body.unit_label || ''),
        client_email: email,
        client_name: clientName,
        container_number: container,
        result: matches ? 'recibida' : 'recibida_con_incidencia',
        incident_id: incidentId,
        notes: matches ? '' : notes,
        content_photo_uri: contentPhoto,
        incident_type: matches ? undefined : type,
        damage_photo_uris: matches ? [] : damagePhotos,
        reviewed_date: now,
        reviewed_by: user.email,
        reviewed_by_name: user.full_name || '',
      });
      return Response.json({ success: true, review });
    }

    // Incidencia directa desde el bulto suelto de la Mesa de empaque.
    if (body.action === 'unit_incident') {
      const container = String(body.container_number || '').trim().toUpperCase();
      const notes = String(body.notes || '').trim().slice(0, 900);
      const photos = (Array.isArray(body.photo_uris) ? body.photo_uris : []).filter(Boolean).slice(0, 10);
      const type = ['abierto', 'faltante', 'danado'].includes(body.incident_type) ? body.incident_type : '';
      const label = String(body.label_code || '').trim();
      if (!container) return Response.json({ error: 'Escribe el N° de contenedor.' }, { status: 400 });
      if (!type) return Response.json({ error: 'Elige el tipo de problema.' }, { status: 400 });
      if (!notes) return Response.json({ error: 'Describe la incidencia.' }, { status: 400 });
      if (!photos.length) return Response.json({ error: 'Agrega al menos una foto.' }, { status: 400 });
      const bultoId = String(body.bulto_id || '');
      const bulto = bultoId ? await svc.Bulto.get(bultoId).catch(() => null) : null;
      const inc = await svc.WarehouseIncident.create({
        bulto_id: bulto?.id || '',
        source: 'mesa_empaque',
        incident_type: type,
        photo_uri: photos[0],
        photo_uris: photos,
        container_number: container,
        client_code: String(bulto?.shipping_mark || body.shipping_mark || '').toUpperCase(),
        client_email: bulto?.client_email || String(body.client_email || ''),
        client_name: bulto?.client_snapshot?.full_name || String(body.client_name || ''),
        notes: `[${bulto?.label_code || label}] ${notes}`,
        reported_date: new Date().toISOString(),
        reported_by: user.email,
        reported_by_name: user.full_name || '',
      });
      return Response.json({ success: true, incident: inc });
    }

    if (body.action === 'review') {
      const bulto = await svc.Bulto.get(String(body.bulto_id || ''));
      if (!bulto) return Response.json({ error: 'Caja no encontrada' }, { status: 404 });
      const matches = !body.has_incident;
      const container = String(body.container_number || '').trim().toUpperCase();
      const notes = String(body.notes || '').trim().slice(0, 1000);
      const now = new Date().toISOString();
      const clientName = bulto.client_snapshot?.full_name || '';
      const reviewTracking = String(body.tracking_number || '').trim();
      const contentPhoto = String(body.content_photo_uri || '');
      const damagePhotos = (Array.isArray(body.damage_photo_uris) ? body.damage_photo_uris : []).filter(Boolean).slice(0, 10);
      const type = ['abierto', 'faltante', 'danado'].includes(body.incident_type) ? body.incident_type : '';
      let incidentId = '';

      if (!container) return Response.json({ error: 'Escribe el N° de contenedor.' }, { status: 400 });
      if (!contentPhoto) return Response.json({ error: 'La foto del contenido es obligatoria.' }, { status: 400 });

      if (!matches) {
        if (!type) return Response.json({ error: 'Elige el tipo de problema.' }, { status: 400 });
        if (!notes) return Response.json({ error: 'Describe la diferencia encontrada.' }, { status: 400 });
        if (!damagePhotos.length) return Response.json({ error: 'Agrega al menos una foto del daño.' }, { status: 400 });
        if (reviewTracking && bulto.client_email) {
          const dup = await svc.WarehouseIncident.filter({ tracking_number: reviewTracking, client_email: bulto.client_email }, '-reported_date', 1);
          if (dup[0]) {
            const when = new Date(dup[0].reported_date || dup[0].created_date).toLocaleString('es-VE', { timeZone: 'America/Caracas' });
            return Response.json({ error: `Esta incidencia ya fue registrada anteriormente (tracking ${reviewTracking}, ${when}).`, duplicate_incident: true }, { status: 409 });
          }
        }
        const inc = await svc.WarehouseIncident.create({
          bulto_id: bulto.id,
          tracking_number: reviewTracking,
          incident_type: type,
          photo_uris: damagePhotos,
          container_number: container,
          client_code: (bulto.shipping_mark || '').toUpperCase(),
          client_email: bulto.client_email,
          client_name: clientName,
          photo_uri: damagePhotos[0],
          notes: `[${reviewTracking || bulto.label_code}] ${notes}`,
          reported_date: now,
          reported_by: user.email,
          reported_by_name: user.full_name || '',
        });
        incidentId = inc.id;
      }

      const review = await svc.CajaInventoryReview.create({
        bulto_id: bulto.id,
        label_code: bulto.label_code,
        client_email: bulto.client_email,
        client_name: clientName,
        container_number: container,
        result: matches ? 'recibida' : 'recibida_con_incidencia',
        incident_id: incidentId,
        notes: matches ? '' : notes,
        content_photo_uri: contentPhoto,
        incident_type: matches ? undefined : type,
        damage_photo_uris: matches ? [] : damagePhotos,
        reviewed_date: now,
        reviewed_by: user.email,
        reviewed_by_name: user.full_name || '',
      });
      return Response.json({ success: true, review });
    }

    return Response.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}