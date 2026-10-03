import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Registra en el historial una impresión de etiquetas de despacho (un lote completo).
// Se llama justo después de que la impresora confirmó el lote, así que el registro
// existe aunque después falle la creación de la guía: el historial es la constancia
// de lo que salió impreso y de dónde se reimprime.
//
// Recibe (impresión nueva): { client_email, client_name?, shipping_mark?, quantity,
//   index_from?, index_to?, units: [{ code, index, total, package_count, cbm, is_caja }],
//   guide_id?, guide_number?, without_boxes?, print_type?, source_log_id?, outcome?,
//   client_snapshot? }
// Recibe (completar un lote ya impreso): { log_id, guide_id, guide_number }
// Devuelve: { log }
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));

    // La guía se crea después de imprimir: ese dato completa el mismo registro, para
    // que el historial muestre una sola impresión y no dos.
    const logId = String(body.log_id || '').trim();
    if (logId) {
      const log = await base44.asServiceRole.entities.LabelPrintLog.update(logId, {
        guide_id: String(body.guide_id || ''),
        guide_number: String(body.guide_number || ''),
      });
      return Response.json({ log });
    }

    const clientEmail = String(body.client_email || '').trim();
    if (!clientEmail) return Response.json({ error: 'Falta el cliente' }, { status: 400 });

    const units = (Array.isArray(body.units) ? body.units : []).map((unit: any) => ({
      label_code: String(unit?.code || '').trim(),
      index: Number(unit?.index) || 0,
      total: Number(unit?.total) || 0,
      package_count: Number(unit?.package_count) || 0,
      cbm: Number(unit?.cbm) || 0,
      is_caja: !!unit?.is_caja,
    }));
    const quantity = Number(body.quantity) || units.length;
    if (!quantity) return Response.json({ error: 'El lote no tiene etiquetas' }, { status: 400 });

    const log = await base44.asServiceRole.entities.LabelPrintLog.create({
      client_email: clientEmail,
      client_name: String(body.client_name || ''),
      shipping_mark: String(body.shipping_mark || ''),
      printed_date: new Date().toISOString(),
      printed_by: user.email || '',
      printed_by_name: user.full_name || '',
      quantity,
      index_from: Number(body.index_from) || 1,
      index_to: Number(body.index_to) || quantity,
      units,
      client_snapshot:
        body.client_snapshot && typeof body.client_snapshot === 'object' ? body.client_snapshot : {},
      guide_id: String(body.guide_id || ''),
      guide_number: String(body.guide_number || ''),
      without_boxes: !!body.without_boxes,
      print_type: body.print_type === 'reimpresion' ? 'reimpresion' : 'primera',
      source_log_id: String(body.source_log_id || ''),
      outcome: body.outcome === 'incompleta' ? 'incompleta' : 'completa',
    });

    return Response.json({ log });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}