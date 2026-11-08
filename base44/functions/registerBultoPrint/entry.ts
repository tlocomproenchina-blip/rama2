import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

// Registra una impresión de etiqueta de bulto.
// Recibe: { bulto_id, reason?, reason_detail? }
// - Valida print_count < 3 o reprint_unlocked=true
// - Incrementa print_count, crea BultoPrintLog, resetea reprint_unlocked si corresponde
// - Retorna el bulto actualizado
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    let sessionUser: any = null;
    try {
      sessionUser = await base44.auth.me();
    } catch (_) {
      sessionUser = null;
    }
    if (sessionUser && sessionUser.role !== 'admin') {
      return Response.json({ error: 'Solo administradores' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    // La Mesa de empaque imprime sin esperar al servidor: la impresión llega después con
    // el id local de la unidad y su código, y aquí se ubica el bulto ya registrado.
    const requestedId: string = String(body.bulto_id || '').trim();
    const labelCode: string = String(body.label_code || '').trim();
    if (!requestedId && !labelCode) return Response.json({ error: 'Falta bulto_id' }, { status: 400 });
    const printedAtRaw = String(body.printed_at || '').trim();
    const printedAt = printedAtRaw && !Number.isNaN(Date.parse(printedAtRaw)) ? printedAtRaw : new Date().toISOString();

    // La pantalla /BultoOrderScan se comparte como enlace de trabajo y abre sin
    // sesión: en ese caso se identifica el dispositivo que imprime.
    const deviceId = String(body.device_id || '').trim();
    if (!sessionUser && !deviceId) {
      return Response.json({ error: 'device_id requerido' }, { status: 400 });
    }
    const printedBy = sessionUser?.email || `Dispositivo ${deviceId.slice(0, 8).toUpperCase()}`;

    const Bulto = base44.asServiceRole.entities.Bulto;
    let bulto: any = requestedId ? await Bulto.get(requestedId).catch(() => null) : null;
    if (!bulto && requestedId) {
      bulto = (await Bulto.filter({ local_unit_id: requestedId }, '-created_date', 1).catch(() => []))?.[0] || null;
    }
    if (!bulto && labelCode) {
      bulto = (await Bulto.filter({ label_code: labelCode }, '-created_date', 1).catch(() => []))?.[0] || null;
    }
    if (!bulto) return Response.json({ error: 'Bulto no encontrado' }, { status: 404 });
    const bultoId: string = bulto.id;

    const currentCount: number = Number(bulto.print_count || 0);
    const unlocked: boolean = !!bulto.reprint_unlocked;

    // Los administradores imprimen sin límite.
    const isAdmin = !!sessionUser && sessionUser.role === 'admin';

    // Validar límite (solo para el personal que imprime desde el enlace público)
    if (currentCount >= 3 && !unlocked && !isAdmin) {
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
      printed_by: printedBy,
      print_date: printedAt,
      approval_status: 'n/a'
    });

    // Actualizar bulto: incrementar contador y resetear unlock si era reimpresion aprobada
    const update: any = { print_count: newCount };
    if (!bulto.first_printed_date) update.first_printed_date = printedAt;
    if (unlocked) {
      update.reprint_unlocked = false;
    }
    const updated = await base44.asServiceRole.entities.Bulto.update(bultoId, update);

    return Response.json({ bulto: updated, log });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}