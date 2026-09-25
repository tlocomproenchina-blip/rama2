import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

// Aprueba una solicitud de reimpresión pendiente.
// Recibe: { print_log_id }
// - Actualiza approval_status='aprobado', approved_by, approved_date
// - Setea reprint_unlocked=true en el bulto correspondiente
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const printLogId: string = body.print_log_id || '';
    if (!printLogId) return Response.json({ error: 'Falta print_log_id' }, { status: 400 });

    const log = await base44.asServiceRole.entities.BultoPrintLog.get(printLogId).catch(() => null);
    if (!log) return Response.json({ error: 'Registro no encontrado' }, { status: 404 });
    if (log.approval_status !== 'pendiente') {
      return Response.json({ error: 'Esta solicitud ya fue procesada' }, { status: 400 });
    }

    // Actualizar log
    const updatedLog = await base44.asServiceRole.entities.BultoPrintLog.update(printLogId, {
      approval_status: 'aprobado',
      approved_by: user.email || '',
      approved_date: new Date().toISOString()
    });

    // Desbloquear reimpresión en el bulto
    await base44.asServiceRole.entities.Bulto.update(log.bulto_id, {
      reprint_unlocked: true
    });

    return Response.json({ log: updatedLog, message: 'Reimpresión aprobada. El operario puede reimprimir una vez más.' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}