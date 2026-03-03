import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1) Crear solicitud pendiente ligada al email del usuario actual
    const created = await base44.entities.ConsolidationRequest.create({
      client_email: user.email,
      shipping_type: 'aereo',
      status: 'pendiente',
      notes: 'Simulación automática de aprobación (prueba)'
    });

    // 2) Aprobar la solicitud (transición real a "aprobada")
    const updated = await base44.entities.ConsolidationRequest.update(created.id, {
      status: 'aprobada',
      approved_by: user.email,
      approved_date: new Date().toISOString()
    });

    // 3) Disparar explícitamente el email/notification por si la automatización estuviera desactivada
    let trigger = null;
    try {
      const res = await base44.asServiceRole.functions.invoke('approvalEmailOnRequestUpdate', {
        event: { entity_name: 'ConsolidationRequest', type: 'update', entity_id: updated.id },
        data: updated,
        old_data: created
      });
      trigger = res?.data || null;
    } catch (_) {}

    return Response.json({ success: true, request_id: updated.id, client_email: user.email, manual_triggered: !!trigger });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});