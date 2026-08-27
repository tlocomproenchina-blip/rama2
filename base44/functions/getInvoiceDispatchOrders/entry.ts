import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Devuelve las órdenes de despacho (DispatchOrder) del cliente vinculadas a los
// recibos de una factura manual, cada una con su CBM, trackings, monto calculado
// de forma independiente y estado pagada/pendiente.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let payload = {};
    try { payload = await req.json(); } catch (_) { payload = {}; }
    const invoiceId = payload.invoice_id;
    if (!invoiceId) return Response.json({ error: 'invoice_id es requerido' }, { status: 400 });

    const invs = await base44.asServiceRole.entities.Invoice.filter({ id: invoiceId });
    if (!invs || invs.length === 0) return Response.json({ error: 'Factura no encontrada' }, { status: 404 });
    const invoice = invs[0];

    const manualRecibos = Array.isArray(invoice.manual_recibos) ? invoice.manual_recibos : [];
    const costBreakdown = invoice.cost_breakdown || null;

    // Si no es una factura manual con recibos, devolver lista vacía
    if (manualRecibos.length === 0 || !costBreakdown) {
      return Response.json({ orders: [], is_manual: false });
    }

    const clientEmail = invoice.client_email;
    const reciboCbmMap = {}; // { invoice_number: cbm }
    const reciboTrackingsMap = {}; // { invoice_number: tracking_numbers[] }
    manualRecibos.forEach((r) => {
      const num_ = String(r.invoice_number || '').trim();
      if (num_) {
        reciboCbmMap[num_] = num(r.cbm);
        reciboTrackingsMap[num_] = Array.isArray(r.tracking_numbers) ? r.tracking_numbers : [];
      }
    });
    const reciboSet = new Set(Object.keys(reciboCbmMap));

    // Obtener órdenes de despacho del cliente (no canceladas)
    const dispatchOrders = await base44.asServiceRole.entities.DispatchOrder.filter(
      { client_email: clientEmail },
      '-created_date',
      200
    ).catch(() => []);

    // Resolver consolidation_tracking faltante vía getDispatchReceiptsMap
    const trackingsToLookup = [];
    (dispatchOrders || []).forEach((o) => {
      (o.items || []).forEach((item) => {
        if (item.tracking_number && !item.consolidation_tracking) {
          trackingsToLookup.push(item.tracking_number);
        }
      });
    });
    let receiptMap = {};
    if (trackingsToLookup.length > 0) {
      try {
        const res = await base44.asServiceRole.functions.invoke('getDispatchReceiptsMap', {
          tracking_numbers: trackingsToLookup
        });
        receiptMap = res?.map || res?.data?.map || {};
      } catch (_) {}
    }

    // Obtener abonos aprobados de la factura para determinar órdenes ya pagadas
    const payments = await base44.asServiceRole.entities.InvoicePayment.filter(
      { invoice_id: invoiceId },
      '-created_date',
      200
    ).catch(() => []);
    const paidOrderIds = new Set();
    (payments || []).forEach((p) => {
      if (p.status === 'aprobado' && Array.isArray(p.dispatch_order_ids)) {
        p.dispatch_order_ids.forEach((id) => paidOrderIds.add(String(id)));
      }
    });

    // Construir resultado por orden
    const totalCbm = num(costBreakdown.total_cbm);
    const billedCbm = num(costBreakdown.billed_cbm || costBreakdown.total_cbm);
    const ratePerCbm = num(costBreakdown.rate_per_cbm);
    const insuranceTotal = num(costBreakdown.insurance_total);
    const consolidationFee = num(costBreakdown.consolidation_fee);
    const doorToDoorFee = num(costBreakdown.door_to_door_fee);
    const extraAmount = num(costBreakdown.extra_amount);

    const orders = (dispatchOrders || [])
      .filter((o) => o.status !== 'cancelada')
      .map((o) => {
        // Recibos únicos referenciados en los items de la orden
        const orderRecibos = new Set();
        const orderTrackings = [];
        (o.items || []).forEach((item) => {
          const recibo = String(item.consolidation_tracking || '').trim()
            || String(receiptMap[item.tracking_number] || '').trim();
          if (recibo && reciboSet.has(recibo)) {
            orderRecibos.add(recibo);
          }
          if (item.tracking_number) orderTrackings.push(item.tracking_number);
        });

        if (orderRecibos.size === 0) return null; // orden no vinculada a recibos de esta factura

        const orderCbm = Array.from(orderRecibos).reduce((s, r) => s + num(reciboCbmMap[r]), 0);
        const ratio = billedCbm > 0 ? orderCbm / billedCbm : 0;

        const shipping = orderCbm * ratePerCbm;
        const insurance = ratio * insuranceTotal;
        const consolidation = ratio * consolidationFee;
        const doorToDoor = ratio * doorToDoorFee;
        const extra = ratio * extraAmount;
        const amount = Math.round((shipping + insurance + consolidation + doorToDoor + extra) * 100) / 100;

        const isPaid = paidOrderIds.has(String(o.id));

        return {
          order_id: o.id,
          order_number: o.order_number,
          status: o.status,
          cbm: Math.round(orderCbm * 10000) / 10000,
          tracking_numbers: orderTrackings,
          recibos: Array.from(orderRecibos),
          amount,
          paid: isPaid,
          breakdown: {
            shipping: Math.round(shipping * 100) / 100,
            insurance: Math.round(insurance * 100) / 100,
            consolidation: Math.round(consolidation * 100) / 100,
            door_to_door: Math.round(doorToDoor * 100) / 100,
            extra: Math.round(extra * 100) / 100,
          },
        };
      })
      .filter(Boolean);

    return Response.json({
      orders,
      is_manual: true,
      cost_breakdown: costBreakdown,
      invoice_total: num(invoice.total),
      paid_amount: num(invoice.paid_amount),
    });
  } catch (error) {
    const message = (error && typeof error === 'object' && 'message' in error) ? error.message : 'Internal Server Error';
    return Response.json({ error: String(message) }, { status: 500 });
  }
}