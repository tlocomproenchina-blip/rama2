import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { waitUntil } from 'base44:runtime';

// Crea una solicitud de aprobación para reimpresión cuando el bulto alcanzó el límite (3).
// Recibe: { bulto_id, reason?, reason_detail? }
// - Crea BultoPrintLog con tipo='solicitud_reimpresion' y approval_status='pendiente'
// - Notifica a admins (best-effort)
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const bultoId: string = body.bulto_id || '';
    if (!bultoId) return Response.json({ error: 'Falta bulto_id' }, { status: 400 });

    const bulto = await base44.asServiceRole.entities.Bulto.get(bultoId).catch(() => null);
    if (!bulto) return Response.json({ error: 'Bulto no encontrado' }, { status: 404 });

    // Validar que ya esté en el límite
    if (Number(bulto.print_count || 0) < 3) {
      return Response.json({ error: 'El bulto aún no alcanzó el límite de reimpresiones' }, { status: 400 });
    }

    // Crear solicitud pendiente
    const log = await base44.asServiceRole.entities.BultoPrintLog.create({
      bulto_id: bultoId,
      label_code: bulto.label_code || '',
      client_email: bulto.client_email || '',
      print_type: 'solicitud_reimpresion',
      reason: body.reason || null,
      reason_detail: body.reason_detail || null,
      printed_by: user.email || '',
      print_date: new Date().toISOString(),
      approval_status: 'pendiente'
    });

    // Notificar a admins (best-effort, no bloquea respuesta)
    waitUntil(
      base44.asServiceRole.entities.Notification.create({
        title: 'Solicitud de reimpresión de etiqueta',
        body: `El bulto ${bulto.label_code} (${bulto.client_email}) alcanzó el límite de 3 impresiones. Motivo: ${body.reason || 'No especificado'}${body.reason_detail ? ' — ' + body.reason_detail : ''}. Revisa la página de Auditoría de Impresiones para aprobar.`,
        type: 'general',
        icon: 'alert'
      }).catch(() => {})
    );

    return Response.json({ log, message: 'Solicitud enviada. Un admin debe aprobar la reimpresión.' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}