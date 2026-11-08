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

    const { invoice_id, option } = await req.json().catch(() => ({}));
    if (!invoice_id || !OPTIONS.includes(option)) {
      return Response.json({ error: 'Factura u opción de entrega inválida' }, { status: 400 });
    }

    const inv = await base44.asServiceRole.entities.Invoice.get(invoice_id)
      .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!inv) return Response.json({ error: 'Factura no encontrada' }, { status: 404 });
    if (lower(inv.client_email) !== lower(user.email) && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
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