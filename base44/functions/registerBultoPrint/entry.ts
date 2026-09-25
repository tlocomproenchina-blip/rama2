import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

// Registra una impresión de etiqueta de bulto.
// Recibe: { bulto_id, reason?, reason_detail? }
// - Valida print_count < 3 o reprint_unlocked=true
// - Incrementa print_count, crea BultoPrintLog, resetea reprint_unlocked si corresponde
// - Retorna el bulto actualizado
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

    const currentCount: number = Number(bulto.print_count || 0);
    const unlocked: boolean = !!bulto.reprint_unlocked;

    // Validar límite
    if (currentCount >= 3 && !unlocked) {
      return Response.json({ error: 'Límite de reimpresiones alcanzado (3). Solicita aprobación de admin.' }, { status: 400 });
    }

    // Determinar tipo de impresión
    let printType: string;
    if (currentCount === 0) {
      printType = 'primera';
    } else if (unlocked) {
      printType = 'reimpresion_aprobada';
    } else {
      printType = 'reimpresion';
    }

    const newCount = currentCount + 1;

    // Crear log de impresión
    const log = await base44.asServiceRole.entities.BultoPrintLog.create({
      bulto_id: bultoId,
      label_code: bulto.label_code || '',
      client_email: bulto.client_email || '',
      print_type: printType,
      reason: body.reason || null,
      reason_detail: body.reason_detail || null,
      printed_by: user.email || '',
      print_date: new Date().toISOString(),
      approval_status: 'n/a'
    });

    // Actualizar bulto: incrementar contador y resetear unlock si era reimpresion aprobada
    const update: any = { print_count: newCount };
    if (unlocked) {
      update.reprint_unlocked = false;
    }
    const updated = await base44.asServiceRole.entities.Bulto.update(bultoId, update);

    return Response.json({ bulto: updated, log });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}