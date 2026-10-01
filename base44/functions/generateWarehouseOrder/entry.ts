import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { buildWarehouseOrder } from "../../shared/warehouseOrder.ts";

// Genera (o regenera, a propósito) la orden de almacén de una factura pagada desde
// Gestión de Facturas. El armado de la orden vive en shared/warehouseOrder.ts, que es
// el mismo módulo que usan las vías de pago para armarla sola.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Solo administradores' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const invoiceId = String(body?.invoice_id || body?.invoiceId || '').trim();
    if (!invoiceId) {
      return Response.json({ error: 'Falta el id de la factura' }, { status: 400 });
    }

    // Acción manual: siempre recalcula la orden con los bultos actuales.
    const result: any = await buildWarehouseOrder(base44, invoiceId, {
      generatedBy: user.email,
      force: true,
    });

    if (result.skipped === 'not_found') {
      return Response.json({ error: 'Factura no encontrada' }, { status: 404 });
    }
    if (result.skipped === 'not_paid') {
      return Response.json({ error: 'La factura todavía no está pagada' }, { status: 400 });
    }
    if (result.empty) {
      return Response.json({ success: true, empty: true, bultos: 0 });
    }

    return Response.json({ success: true, order: result.order, bultos: result.bultos });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}