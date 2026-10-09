import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  buildDispatchOrderSheet,
  loadDispatchOrderConfig,
  isDayKey,
  renderDispatchOrderText,
} from '../../shared/dispatchOrderSheet.ts';

// Orden de despacho para el almacén de un período: agrupa TODAS las facturas pagadas
// dentro de las fechas elegidas y devuelve el documento con los clientes por ciudad,
// shipping mark, el N° de orden/envío y el conteo de cajas y bultos de cada orden.
// El armado vive en shared/dispatchOrderSheet.ts. El rango ya generado se reutiliza
// tal cual; solo se recalcula cuando llega force = true.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Solo administradores' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const from = String(body?.from || '').trim();
    const to = String(body?.to || '').trim();
    const force = body?.force === true;

    if (!isDayKey(from) || !isDayKey(to)) {
      return Response.json({ error: 'Elige la fecha de inicio y la de fin del período.' }, { status: 400 });
    }
    if (from > to) {
      return Response.json({ error: 'La fecha de inicio no puede ser posterior a la fecha de fin.' }, { status: 400 });
    }

    const config: any = await loadDispatchOrderConfig(base44);
    const result: any = await buildDispatchOrderSheet(base44, {
      from,
      to,
      generatedBy: user.email,
      force,
    });

    if (result.empty && !result.invoices) {
      return Response.json({
        success: true,
        empty: true,
        message: 'No hay facturas pagadas en ese período. Elige otras fechas.',
      });
    }
    if (result.empty) {
      return Response.json({
        success: true,
        empty: true,
        message: `Hay ${result.invoices} factura(s) pagada(s) en el período, pero todavía no tienen bultos ni cajas vinculados.`,
      });
    }

    const sheet = result.sheet;
    return Response.json({
      success: true,
      reused: !!result.reused,
      regenerated: !!result.regenerated,
      sheet,
      // El texto se rearma con el snapshot guardado, así el formato vigente se ve
      // también en las órdenes que ya estaban generadas.
      text: renderDispatchOrderText(sheet),
      whatsapp_phone: String(config?.warehouse_whatsapp_phone || ''),
      warehouse_label: String(config?.warehouse_label || ''),
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}