import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { invoiceId } = await req.json();
    if (!invoiceId) {
      return Response.json({ error: 'invoiceId es requerido' }, { status: 400 });
    }

    const invoices = await base44.asServiceRole.entities.Invoice.filter({ id: invoiceId });
    const invoice = invoices?.[0];
    if (!invoice) {
      return Response.json({ error: 'Factura no encontrada' }, { status: 404 });
    }

    const configs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });
    const cfg = configs?.[0] || {};

    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const seaRate = num(cfg.provider_rate_sea_general);
    const insurancePct = num(cfg.provider_insurance_percentage);
    const receptionFee = num(cfg.provider_reception_fee);
    const specialRanges = Array.isArray(cfg.provider_special_cbm_rates) ? cfg.provider_special_cbm_rates : [];

    let providerCost = 0;
    let totalCbm = 0;
    let trackingCount = 0;
    const breakdown = [];

    for (const item of invoice.items || []) {
      const d = item.details || {};
      if (d.cbm !== undefined) {
        // Flete: usar rango especial si CBM < 0.130, sino tarifa por CBM
        const cbm = num(d.cbm);
        totalCbm += cbm;
        let cost;
        const range = cbm > 0 && cbm < 0.13
          ? specialRanges.find((r) => cbm >= num(r.min_cbm) && cbm <= num(r.max_cbm))
          : null;
        if (range) {
          cost = num(range.rate_regular);
        } else {
          cost = cbm * seaRate;
        }
        providerCost += cost;
        breakdown.push({ concepto: `Flete ${cbm} CBM`, costo: Math.round(cost * 100) / 100 });
      } else if (d.fob_value !== undefined) {
        // Seguro
        const cost = num(d.fob_value) * insurancePct / 100;
        providerCost += cost;
        breakdown.push({ concepto: `Seguro (FOB $${num(d.fob_value)})`, costo: Math.round(cost * 100) / 100 });
      } else if (d.package_count !== undefined) {
        // Recepción de paquetes
        trackingCount = num(d.package_count);
        const cost = trackingCount * receptionFee;
        providerCost += cost;
        breakdown.push({ concepto: `Recepción ${trackingCount} paquete(s)`, costo: Math.round(cost * 100) / 100 });
      }
    }

    providerCost = Math.round(providerCost * 100) / 100;
    const profit = Math.round((num(invoice.total) - providerCost) * 100) / 100;

    // Crear cuenta por pagar al proveedor
    const ap = await base44.asServiceRole.entities.AccountsPayable.create({
      vendor_name: 'Proveedor Logística Marítima',
      description: `Costo proveedor - Factura ${invoice.invoice_number || invoice.id} (${invoice.client_email})`,
      original_amount_due: providerCost,
      balance_due: providerCost,
      amount_paid: 0,
      status: 'pendiente',
      currency: 'USD',
      category: 'flete_maritimo',
      related_consolidation_id: invoice.consolidation_id || '',
      cbm: Math.round(totalCbm * 10000) / 10000,
      tracking_count: trackingCount
    });

    // Guardar costo y ganancia en la factura
    await base44.asServiceRole.entities.Invoice.update(invoice.id, {
      provider_cost_total: providerCost,
      profit_amount: profit
    });

    return Response.json({
      success: true,
      invoice_total: num(invoice.total),
      provider_cost_total: providerCost,
      profit_amount: profit,
      accounts_payable_id: ap.id,
      breakdown
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});