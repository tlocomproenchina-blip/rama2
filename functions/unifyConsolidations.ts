import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Unifica Consolidations abiertas (sin shipping_date) del mismo cliente y tipo
// Estrategia:
//  - Disparada por automations (create/update de Consolidation) o manual con {client_email, shipping_type}
//  - Considera "abiertas" aquellas con shipping_date null/undefined (aún no han salido)
//  - Crea una nueva consolidación maestra con la unión de package_ids y tracking_numbers
//  - Elimina las demás consolidaciones abiertas del grupo

function uniq(arr) { return Array.from(new Set((arr || []).filter(Boolean))); }

async function fetchConsolidation(base44, id) {
  try { return await base44.asServiceRole.entities.Consolidation.get(id); } catch { return null; }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Puede ejecutarse por automation sin sesión
    try { await base44.auth.me(); } catch (_) {}

    const body = await req.json().catch(() => ({}));

    let clientEmail = body.client_email;
    let shippingType = body.shipping_type;

    if ((!clientEmail || !shippingType) && body?.event?.entity_name === 'Consolidation') {
      let data = body.data;
      if (!data && body.event?.entity_id) data = await fetchConsolidation(base44, body.event.entity_id);
      clientEmail = clientEmail || data?.client_email;
      shippingType = shippingType || data?.shipping_type;
    }

    if (!clientEmail || !shippingType) {
      return Response.json({ success: false, reason: 'missing_params', message: 'Faltan client_email o shipping_type' }, { status: 400 });
    }

    const all = await base44.asServiceRole.entities.Consolidation.filter({ client_email: clientEmail, shipping_type: shippingType }, '-created_date');
    const openOnes = (all || []).filter(c => !c.shipping_date);

    if (openOnes.length <= 1) {
      return Response.json({ success: true, action: 'noop', message: 'Nada que unificar', count: openOnes.length });
    }

    const pkgIds = uniq(openOnes.flatMap(c => c.package_ids || []));
    const trackings = uniq(openOnes.flatMap(c => c.tracking_numbers || []));
    const shippingMark = openOnes.find(c => c.shipping_mark)?.shipping_mark || openOnes[0]?.shipping_mark || '';

    const master = await base44.asServiceRole.entities.Consolidation.create({
      client_email: clientEmail,
      shipping_mark: shippingMark,
      package_ids: pkgIds,
      tracking_numbers: trackings,
      shipping_type: shippingType,
      // Importante: no establecer shipping_date para mantenerla como "abierta"
      status: 'en_transito' // default; se actualizará cuando realmente salga
    });

    // Eliminar las antiguas (excepto la recién creada)
    await Promise.all(
      openOnes.map(async (c) => {
        try {
          await base44.asServiceRole.entities.Consolidation.delete(c.id);
        } catch (_) {}
      })
    );

    return Response.json({ success: true, action: 'merged', master_id: master.id, merged_count: openOnes.length, packages: pkgIds.length, trackings: trackings.length });
  } catch (error) {
    return Response.json({ success: false, error: String(error?.message || error) }, { status: 500 });
  }
});