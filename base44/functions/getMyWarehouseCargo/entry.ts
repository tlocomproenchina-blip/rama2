import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Devuelve al cliente autenticado su carga en almacén: bultos y cajas consolidadas,
// más las guías de despacho emitidas a su nombre, con su detalle de bultos.
// Bulto y DispatchGuide tienen RLS solo para admins, por eso se usa asServiceRole
// y se devuelven únicamente los campos que el cliente necesita ver.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const [bultoRes, guideRes] = await Promise.all([
      base44.asServiceRole.entities.Bulto.filter({ client_email: user.email }, '-created_date', 300),
      base44.asServiceRole.entities.DispatchGuide.filter({ client_emails: user.email }, '-emitted_date', 100),
    ]);

    const bultoList = Array.isArray(bultoRes) ? bultoRes : (bultoRes?.items || []);
    const guideList = Array.isArray(guideRes) ? guideRes : (guideRes?.items || []);

    // Volumen real de los paquetes: se usa cuando el bulto no tiene un CBM oficial registrado.
    // Los ids del escaneo offline ('local_pkg_...') no existen como registro y hacen
    // fallar la consulta de paquetes, así que se descartan antes de pedirlos.
    const ids = [...new Set(bultoList.flatMap((b) => (Array.isArray(b.package_ids) ? b.package_ids : [])))]
      .filter((id) => id && !String(id).startsWith('local_'))
      .slice(0, 300);
    const cbmByPackage = {};
    const pkgById = {};
    if (ids.length) {
      const pkgRes = await base44.asServiceRole.entities.Package.filter({ id: { $in: ids } }, '-created_date', 300);
      const pkgs = Array.isArray(pkgRes) ? pkgRes : (pkgRes?.items || []);
      for (const p of pkgs) {
        cbmByPackage[p.id] = Number(p.actual_cbm || 0);
        // Solo los paquetes del propio cliente se muestran con su detalle.
        if (p.client_email === user.email) {
          pkgById[p.id] = {
            tracking: p.tracking_number || '',
            description: p.description || '',
            photo: (Array.isArray(p.package_image_urls) && p.package_image_urls[0]) || p.package_image_url || '',
            received_date: p.received_date || null,
            cbm: Number(p.actual_cbm || 0),
            weight_kg: Number(p.actual_weight_kg || 0),
          };
        }
      }
    }

    // Revisión de inventario al llegar: estado de recepción y, si hubo incidencia,
    // su detalle con la foto por enlace firmado temporal.
    const reviewByBulto: Record<string, any> = {};
    if (bultoList.length) {
      const reviews = await base44.asServiceRole.entities.CajaInventoryReview.filter(
        { bulto_id: { $in: bultoList.map((b) => b.id) }, client_email: user.email }, '-reviewed_date', 500);
      for (const r of reviews) if (!reviewByBulto[r.bulto_id]) reviewByBulto[r.bulto_id] = r;
      for (const r of Object.values(reviewByBulto)) {
        if (!r.incident_id) continue;
        const inc = await base44.asServiceRole.entities.WarehouseIncident.get(r.incident_id).catch(() => null);
        if (inc?.client_email !== user.email || !inc.photo_uri) continue;
        const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: inc.photo_uri, expires_in: 3600 }).catch(() => null);
        r._photo_url = signed?.signed_url || '';
      }
    }

    const bultos = bultoList.map((b) => {
      const pkgIds = Array.isArray(b.package_ids) ? b.package_ids : [];
      const unregistered = Array.isArray(b.unregistered_codes) ? b.unregistered_codes : [];
      const cbmFromPackages = pkgIds.reduce((sum, id) => sum + (cbmByPackage[id] || 0), 0);
      return {
        id: b.id,
        label_code: b.label_code || '',
        is_caja: !!b.is_caja,
        caja_number: b.caja_number || null,
        caja_total: b.caja_total || null,
        bulto_number: b.bulto_number || 1,
        total_bultos: b.total_bultos || b.bulto_number || 1,
        status: b.status || 'activo',
        package_count: b.cargo_package_count ?? (pkgIds.length + unregistered.length),
        cbm: Number(b.cargo_cbm || 0) || cbmFromPackages,
        order_numbers: Array.isArray(b.cbm_order_numbers) ? b.cbm_order_numbers : [],
        trackings: (Array.isArray(b.package_trackings) ? b.package_trackings : []).filter(Boolean),
        packages: pkgIds.map((id) => pkgById[id]).filter(Boolean),
        unregistered_codes: unregistered.filter(Boolean),
        recognized_date: b.ve_recognized_date || null,
        created_date: b.created_date || null,
        reception: reviewByBulto[b.id] ? {
          result: reviewByBulto[b.id].result,
          date: reviewByBulto[b.id].reviewed_date,
          container_number: reviewByBulto[b.id].container_number || '',
          notes: reviewByBulto[b.id].result === 'recibida_con_incidencia' ? reviewByBulto[b.id].notes : '',
          photo_url: reviewByBulto[b.id]._photo_url || '',
        } : null,
      };
    });

    const guides = guideList
      .map((g) => {
        const entry = (Array.isArray(g.clients) ? g.clients : []).find((c) => (c.client_email || '').trim() === user.email);
        if (!entry) return null;
        return {
          id: g.id,
          guide_number: g.guide_number,
          emitted_date: g.emitted_date || g.created_date || null,
          dispatch_status: g.dispatch_status || 'emitida',
          delivered_date: g.delivered_date || null,
          received_by: g.received_by || '',
          delivery_notes: g.delivery_notes || '',
          totals: entry.totals || {},
          bultos: (Array.isArray(entry.bultos) ? entry.bultos : []).map((b) => ({
            label_code: b.label_code || '',
            is_caja: !!b.is_caja,
            caja_number: b.caja_number || null,
            caja_total: b.caja_total || null,
            order_number: b.order_number || '',
            package_count: b.package_count || 0,
            cbm: Number(b.cbm || 0),
          })),
        };
      })
      .filter(Boolean);

    return Response.json({ bultos, guides });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}