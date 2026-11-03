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

    if (body.action === 'review') {
      const bulto = await svc.Bulto.get(String(body.bulto_id || ''));
      if (!bulto) return Response.json({ error: 'Caja no encontrada' }, { status: 404 });
      const matches = !body.has_incident;
      const container = String(body.container_number || '').trim().toUpperCase();
      const notes = String(body.notes || '').trim().slice(0, 1000);
      const now = new Date().toISOString();
      const clientName = bulto.client_snapshot?.full_name || '';
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
        const inc = await svc.WarehouseIncident.create({
          bulto_id: bulto.id,
          incident_type: type,
          photo_uris: damagePhotos,
          container_number: container,
          client_code: (bulto.shipping_mark || '').toUpperCase(),
          client_email: bulto.client_email,
          client_name: clientName,
          photo_uri: damagePhotos[0],
          notes: `[${bulto.label_code}] ${notes}`,
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