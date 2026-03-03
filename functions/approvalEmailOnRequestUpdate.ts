import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data, old_data } = await req.json();

    if (event?.entity_name !== 'ConsolidationRequest' || event?.type !== 'update') {
      return Response.json({ success: true, skipped: 'not ConsolidationRequest update' });
    }

    const request = data;
    if (!request?.client_email) {
      return Response.json({ success: true, skipped: 'no client_email' });
    }

    // Trigger only when status transitions to 'aprobada'
    if (!old_data || old_data.status === 'aprobada' || request.status !== 'aprobada') {
      return Response.json({ success: true, skipped: 'no approval transition' });
    }

    // In‑app notification
    await base44.asServiceRole.entities.Notification.create({
      user_email: request.client_email,
      title: '✅ Solicitud aprobada',
      message: 'Tu solicitud de consolidación ha sido aprobada. Puedes proceder a consolidar.',
      type: 'request',
      priority: 'medium',
      reference_id: request.id,
      entity_type: 'Consolidation',
      icon: 'check'
    });

    // Email to client
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: request.client_email,
        subject: 'Solicitud de consolidación aprobada',
        body: `Hola,\n\nTu solicitud de consolidación ha sido aprobada.\nTracking(s) seleccionados: ${(request.tracking_numbers || []).join(', ') || 'N/A'}\n\nYa puedes continuar con el proceso desde tu panel.\n\nSaludos,\nEquipo de Soporte`
      });
    } catch (_e) {}

    return Response.json({ success: true, notified: request.client_email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});