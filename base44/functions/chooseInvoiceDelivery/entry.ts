import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { applyCreditsToUnpaidInvoices } from '../../shared/clientCredit.ts';

const OPTIONS = ['retiro_almacen', 'puerta_a_puerta'];
const DEFAULT_RATE = 150;
const num = (v) => Number(v) || 0;
const round = (n) => Math.round(n * 100) / 100;
const lower = (v) => String(v || '').trim().toLowerCase();

// El cliente elige cómo recibir su carga. El monto puerta a puerta se calcula
// aquí (tarifa vigente × CBM facturado), nunca con datos del navegador, y la
// elección queda fija: después ya no se puede cambiar.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { invoice_id, option, action } = await req.json().catch(() => ({}));
    const isReset = action === 'reset';
    if (!invoice_id || (!isReset && !OPTIONS.includes(option))) {
      return Response.json({ error: 'Factura u opción de entrega inválida' }, { status: 400 });
    }

    const inv = await base44.asServiceRole.entities.Invoice.get(invoice_id)
      .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!inv) return Response.json({ error: 'Factura no encontrada' }, { status: 404 });
    if (lower(inv.client_email) !== lower(user.email) && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    // Volver atrás: deshace la elección mientras la factura no tenga pagos ni abonos
    if (isReset) {
      if (inv.delivery_choice_status !== 'elegida') {
        return Response.json({ error: 'Esta factura aún no tiene una opción de entrega elegida', invoice: inv }, { status: 409 });
      }
      if (inv.status !== 'pendiente' || num(inv.paid_amount) > 0) {
        return Response.json({ error: 'Ya no puedes cambiar la entrega: la factura tiene un pago o abono registrado' }, { status: 409 });
      }
      const resetUpdates = {
        delivery_choice_status: 'pendiente',
        delivery_option: null,
        delivery_choice_date: null,
        delivery_choice_by: null,
      };
      if (inv.delivery_option === 'puerta_a_puerta') {
        const items = Array.isArray(inv.items) ? inv.items : [];
        const d2d = items.filter((i) => i?.details?.door_to_door);
        const amount = d2d.length ? d2d.reduce((s, i) => s + num(i.total), 0) : num(inv.door_to_door_quote?.amount);
        const { door_to_door_fee, ...restBreakdown } = inv.cost_breakdown || {};
        resetUpdates.items = items.filter((i) => !i?.details?.door_to_door);
        resetUpdates.subtotal = round(num(inv.subtotal) - amount);
        resetUpdates.total = round(num(inv.total) - amount);
        resetUpdates.cost_breakdown = restBreakdown;
      }
      await base44.asServiceRole.entities.Invoice.update(inv.id, resetUpdates);
      const reverted = await base44.asServiceRole.entities.Invoice.get(inv.id);
      return Response.json({ success: true, invoice: reverted });
    }
    if (inv.delivery_choice_status !== 'pendiente') {
      return Response.json({ error: 'Esta factura ya tiene una opción de entrega elegida', invoice: inv }, { status: 409 });
    }
    if (['pagada', 'cancelada'].includes(inv.status)) {
      return Response.json({ error: 'La factura ya no admite cambios' }, { status: 409 });
    }

    const updates = {
      delivery_option: option,
      delivery_choice_status: 'elegida',
      delivery_choice_date: new Date().toISOString(),
      delivery_choice_by: user.email,
    };

    if (option === 'puerta_a_puerta') {
      const cfgs = await base44.asServiceRole.entities.DoorToDoorConfig.filter({ config_key: 'main' }, '-updated_date', 1);
      const cfgRate = Number(cfgs?.[0]?.rate_per_cbm);
      const rate = Number.isFinite(cfgRate) && cfgRate >= 0 ? cfgRate : DEFAULT_RATE;
      const cbm = num(inv.billed_cbm) > 0 ? num(inv.billed_cbm) : num(inv.total_cbm);
      const amount = round(rate * cbm);
      updates.items = [
        ...(Array.isArray(inv.items) ? inv.items : []),
        {
          description: `Envío puerta a puerta (${cbm.toFixed(4)} CBM × $${rate.toFixed(2)})`,
          quantity: cbm,
          unit_price: rate,
          total: amount,
          details: { door_to_door: true, cbm, rate_per_cbm: rate },
        },
      ];
      updates.subtotal = round(num(inv.subtotal) + amount);
      updates.total = round(num(inv.total) + amount);
      updates.cost_breakdown = { ...(inv.cost_breakdown || {}), door_to_door_fee: amount };
      updates.door_to_door_quote = { rate_per_cbm: rate, cbm, amount };
    }

    await base44.asServiceRole.entities.Invoice.update(inv.id, updates);
    // Con el monto ya definido, se aplica el saldo a favor que tenga el cliente
    await applyCreditsToUnpaidInvoices(base44, inv.client_email).catch(() => null);
    const fresh = await base44.asServiceRole.entities.Invoice.get(inv.id);
    return Response.json({ success: true, invoice: fresh });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}