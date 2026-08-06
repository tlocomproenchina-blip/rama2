import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Marca una orden de despacho como "despachado" (confirmación de despacho).
// En ese momento captura un snapshot del total de paquetes por recibo,
// para poder mostrar "X de Y paquetes" en la tarjeta.
// Una vez despachada, la orden no acepta más paquetes (createDispatchOrder
// solo busca órdenes "emitida" para agregar items).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { order_id } = body;
    if (!order_id) return Response.json({ error: 'order_id es requerido' }, { status: 400 });

    const order = await base44.asServiceRole.entities.DispatchOrder.get(order_id);
    if (!order) return Response.json({ error: 'Orden no encontrada' }, { status: 404 });
    if (order.status === 'cancelada') return Response.json({ error: 'No se puede despachar una orden cancelada' }, { status: 400 });

    // Si ya está despachada y se vuelve a marcar, solo revertir a emitida
    if (order.status === 'despachado') {
      await base44.asServiceRole.entities.DispatchOrder.update(order_id, {
        status: 'emitida',
        dispatched_confirmed_date: null,
        dispatched_confirmed_by: null,
        receipt_totals: {}
      });
      return Response.json({ order: { ...order, status: 'emitida', dispatched_confirmed_date: null, dispatched_confirmed_by: null, receipt_totals: {} }, reverted: true });
    }

    // Snapshot: total de paquetes por recibo al momento de confirmar el despacho
    const items = Array.isArray(order.items) ? order.items : [];
    const receipts = [...new Set(items.map((i) => (i.consolidation_tracking || '').trim()).filter(Boolean))];

    const receipt_totals = {};
    for (const receipt of receipts) {
      try {
        const pkgs = await base44.asServiceRole.entities.Package.filter(
          { consolidation_tracking: receipt },
          '-created_date',
          500
        );
        receipt_totals[receipt] = Array.isArray(pkgs) ? pkgs.length : 0;
      } catch {
        receipt_totals[receipt] = items.filter((i) => (i.consolidation_tracking || '').trim() === receipt).length;
      }
    }

    const now = new Date().toISOString();
    await base44.asServiceRole.entities.DispatchOrder.update(order_id, {
      status: 'despachado',
      dispatched_confirmed_date: now,
      dispatched_confirmed_by: user.email,
      receipt_totals
    });

    return Response.json({
      order: { ...order, status: 'despachado', dispatched_confirmed_date: now, dispatched_confirmed_by: user.email, receipt_totals },
      receipt_totals
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}