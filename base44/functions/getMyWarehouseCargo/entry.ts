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
    const ids = [...new Set(bultoList.flatMap((b) => (Array.isArray(b.package_ids) ? b.package_ids : [])))].slice(0, 300);
    const cbmByPackage = {};
    if (ids.length) {
      const pkgRes = await base44.asServiceRole.entities.Package.filter({ id: { $in: ids } }, '-created_date', 300);
      const pkgs = Array.isArray(pkgRes) ? pkgRes : (pkgRes?.items || []);
      for (const p of pkgs) cbmByPackage[p.id] = Number(p.actual_cbm || 0);
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
        recognized_date: b.ve_recognized_date || null,
        created_date: b.created_date || null,
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