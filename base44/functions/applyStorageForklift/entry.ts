// Aplicación MANUAL del recargo de montacargas.
//
// El proceso diario de almacenamiento ya no cobra montacargas: los palets
// marcados en los bultos quedan solo como referencia. El administrador decide
// cuándo corresponde y aquí se suma UNA sola vez por palet: se actualiza la
// factura y se deja el registro para auditoría.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  loadStorageConfig,
  storageDayKey,
  storageDayNumber,
  round2,
  num,
  text,
  FORKLIFT_LINE_KIND,
} from '../../shared/storageCharges.ts';

const plural = (count: number) => `${count} palet${count === 1 ? '' : 's'}`;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    const payload: any = await req.json().catch(() => ({}));
    const invoiceId = text(payload?.invoice_id);
    const pallets = Math.max(0, Math.round(num(payload?.pallets)));
    if (!invoiceId) return Response.json({ error: 'Falta la factura' }, { status: 400 });
    if (pallets < 1) return Response.json({ error: 'Indica al menos un palet' }, { status: 400 });

    const config = await loadStorageConfig(base44);
    const fee = num(config?.forklift_fee) || 150;
    const amount = round2(pallets * fee);

    const invoice: any = await base44.asServiceRole.entities.Invoice.get(invoiceId);
    if (!invoice) return Response.json({ error: 'Factura no encontrada' }, { status: 404 });
    if (invoice.locked === true) {
      return Response.json({ error: 'Esta factura está protegida y no se le pueden agregar cargos.' }, { status: 409 });
    }

    const items = Array.isArray(invoice.items) ? invoice.items : [];
    const index = items.findIndex((item: any) => text(item?.details?.kind) === FORKLIFT_LINE_KIND);
    const now = new Date().toISOString();

    let newItems: any[];
    if (index >= 0) {
      // Ya había un recargo aplicado: se acumulan palets y monto en la misma línea.
      newItems = items.map((item: any, position: number) => {
        if (position !== index) return item;
        const totalPallets = num(item?.details?.pallets) + pallets;
        const totalAmount = round2(num(item?.total) + amount);
        return {
          description: `Uso de montacargas (${plural(totalPallets)})`,
          quantity: totalPallets,
          unit_price: round2(totalAmount / totalPallets),
          total: totalAmount,
          details: { ...(item?.details || {}), pallets: totalPallets, charged_once: true, applied_by: user.email, updated_date: now },
        };
      });
    } else {
      newItems = [
        ...items,
        {
          description: `Uso de montacargas (${plural(pallets)})`,
          quantity: pallets,
          unit_price: round2(fee),
          total: amount,
          details: { kind: FORKLIFT_LINE_KIND, pallets, charged_once: true, applied_by: user.email, updated_date: now },
        },
      ];
    }

    const newTotal = round2(num(invoice.total) + amount);
    const newSubtotal = round2(num(invoice.subtotal) + amount);
    await base44.asServiceRole.entities.Invoice.update(invoice.id, {
      items: newItems,
      subtotal: newSubtotal,
      total: newTotal,
    });

    const previous = await base44.asServiceRole.entities.StorageCharge
      .filter({ invoice_id: invoice.id }, { sort: '-day_number', limit: 300 })
      .catch(() => ({ items: [] }));
    const records = previous?.items || [];
    const accumulatedBefore = round2(records.reduce((sum: number, row: any) => sum + num(row.amount), 0));

    await base44.asServiceRole.entities.StorageCharge.create({
      invoice_id: invoice.id,
      invoice_number: text(invoice.invoice_number),
      client_email: text(invoice.client_email),
      charge_date: storageDayKey(),
      day_number: storageDayNumber(invoice.invoice_date),
      covered_days: [],
      days_count: 0,
      units_standard: 0,
      units_large: 0,
      units_source: 'ninguna',
      daily_rate_standard: num(config?.standard_daily_rate),
      daily_rate_large: num(config?.large_daily_rate),
      daily_amount: 0,
      storage_amount: 0,
      forklift_pallets_today: pallets,
      forklift_amount: amount,
      amount,
      accumulated_amount: round2(accumulatedBefore + amount),
      invoice_total_before: round2(num(invoice.total)),
      invoice_total_after: newTotal,
      notified: false,
      created_by: user.email || 'admin',
      notes: `Recargo único de montacargas aplicado a mano: ${plural(pallets)} × $${round2(fee).toFixed(2)}.`,
    });

    return Response.json({ success: true, pallets, fee, amount, total: newTotal });
  } catch (error: any) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
}