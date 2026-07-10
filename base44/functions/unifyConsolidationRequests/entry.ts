import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Unifica ConsolidationRequest del mismo cliente y tipo de envío
// Estrategia:
// - Disparada por automations (create/update de ConsolidationRequest) o manual con {client_email, shipping_type}
// - Agrupa por client_email + shipping_type con estados [pendiente, aprobada]
// - Crea una nueva solicitud "maestra" con la unión de package_ids y tracking_numbers
// - Marca las demás como canceladas y anota referencia a la maestra en notes

function uniqueArray(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

async function fetchRequest(base44, id) {
  try { return await base44.asServiceRole.entities.ConsolidationRequest.get(id); } catch { return null; }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Strict auth: no silent auth failures before privileged operations
    let user = null;
    try { user = await base44.auth.me(); } catch { user = null; }
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    // Entrada: desde automation → { event, data, old_data, payload_too_large }
    // Entrada manual: { client_email, shipping_type }
    let clientEmail = body.client_email;
    let shippingType = body.shipping_type;

    if ((!clientEmail || !shippingType) && body?.event?.entity_name === 'ConsolidationRequest') {
      let reqData = body.data;
      if (!reqData && body.event?.entity_id) {
        reqData = await fetchRequest(base44, body.event.entity_id);
      }
      clientEmail = clientEmail || reqData?.client_email;
      shippingType = shippingType || reqData?.shipping_type;
    }

    if (!clientEmail || !shippingType) {
      return Response.json({ success: false, reason: 'missing_params', message: 'Faltan client_email o shipping_type' }, { status: 400 });
    }

    // Authorization: non-admins can only unify their own requests
    if (user.role !== 'admin' && clientEmail !== user.email) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Buscar solicitudes pendientes o aprobadas del mismo cliente/tipo
    const candidates = await base44.asServiceRole.entities.ConsolidationRequest.filter({
      client_email: clientEmail,
      shipping_type: shippingType
    }, '-created_date');

    const eligible = (candidates || []).filter(r => r.status === 'pendiente' || r.status === 'aprobada');
    if (eligible.length <= 1) {
      return Response.json({ success: true, action: 'noop', message: 'Nada que unificar', count: eligible.length });
    }

    // Elegir datos base
    const allPackageIds = uniqueArray(eligible.flatMap(r => r.package_ids || []));
    const allTrackings = uniqueArray(eligible.flatMap(r => r.tracking_numbers || []));

    // Tomar shipping_mark del más reciente con valor, o del primero
    let shippingMark = eligible.find(r => r.shipping_mark)?.shipping_mark || eligible[eligible.length - 1]?.shipping_mark || '';

    // Crear nueva solicitud maestra
    const master = await base44.asServiceRole.entities.ConsolidationRequest.create({
      client_email: clientEmail,
      shipping_mark: shippingMark,
      package_ids: allPackageIds,
      tracking_numbers: allTrackings,
      shipping_type: shippingType,
      status: 'pendiente',
      notes: `Auto-unificada (${eligible.length}) el ${new Date().toISOString()}`
    });

    // Cancelar las antiguas
    await Promise.all(
      eligible.map(async (r) => {
        try {
          await base44.asServiceRole.entities.ConsolidationRequest.update(r.id, {
            status: 'cancelada',
            notes: `Fusionada en ${master.id} (${new Date().toISOString()})`
          });
        } catch (_) { /* continuar */ }
      })
    );

    return Response.json({ success: true, action: 'merged', master_id: master.id, merged_count: eligible.length, packages: allPackageIds.length, trackings: allTrackings.length });
  } catch (error) {
    return Response.json({ success: false, error: String(error?.message || error) }, { status: 500 });
  }
});