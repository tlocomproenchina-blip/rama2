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

    // Costo proveedor = Tarifa base (Regular/Alto Riesgo) + Costo puerta a puerta + Tarifa de envío del estado del cliente
    const clientUsers = await base44.asServiceRole.entities.User.filter({ email: invoice.client_email });
    const clientUser = clientUsers?.[0] || {};
    const stateCode = String(clientUser.state || '').trim().toLowerCase();
    const isHighRisk = String(clientUser.risk_category || '').toLowerCase().includes('alto');

    let stateShippingRate = 0;
    if (stateCode) {
      const states = await base44.asServiceRole.entities.StateConfig.filter({ state_code: stateCode });
      stateShippingRate = num(states?.[0]?.shipping_rate);
    }

    const baseRate = isHighRisk ? num(cfg.provider_rate_sea_sensitive) : num(cfg.provider_rate_sea_general);
    const doorToDoor = num(cfg.provider_door_to_door_cost);

    let totalCbm = 0;
    let trackingCount = 0;
    for (const item of invoice.items || []) {
      const d = item.details || {};
      if (d.cbm !== undefined) totalCbm += num(d.cbm);
      if (d.package_count !== undefined) trackingCount = num(d.package_count);
    }

    const breakdown = [
      { concepto: `Tarifa base ${isHighRisk ? 'Alto Riesgo' : 'Regular'}`, costo: Math.round(baseRate * 100) / 100 },
      { concepto: 'Costo puerta a puerta', costo: Math.round(doorToDoor * 100) / 100 },
      { concepto: `Tarifa de envío (${stateCode || 'sin estado'})`, costo: Math.round(stateShippingRate * 100) / 100 },
    ];

    let providerCost = baseRate + doorToDoor + stateShippingRate;
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