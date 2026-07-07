import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { invoiceId, providerInvoiceUrl } = await req.json();
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

    // Tarifas reales del proveedor marítimo (ShippingProvider). Usar el predeterminado o el primer activo.
    const providers = await base44.asServiceRole.entities.ShippingProvider.filter({ mode: 'maritimo' });
    const provider = (providers || []).find((p) => p.is_default_for_mode && p.is_active)
      || (providers || []).find((p) => p.is_active)
      || (providers || [])[0]
      || {};

    // Tarifa de envío del estado: override del proveedor si existe, si no StateConfig
    let stateShippingRate = 0;
    if (stateCode) {
      const override = (provider.state_overrides || []).find((o) => String(o.state_code).toLowerCase() === stateCode);
      if (override && override.shipping_rate !== undefined && override.shipping_rate !== null) {
        stateShippingRate = num(override.shipping_rate);
      } else {
        const states = await base44.asServiceRole.entities.StateConfig.filter({ state_code: stateCode });
        stateShippingRate = num(states?.[0]?.shipping_rate);
      }
    }

    const baseRate = isHighRisk ? num(provider.base_rate_high_risk) : num(provider.base_rate_regular);
    const doorToDoor = num(provider.door_to_door_cost);
    const perTracking = isHighRisk ? num(provider.per_tracking_high) : num(provider.per_tracking_regular);
    const consolidationFeePct = num(provider.consolidation_fee_percentage);

    let totalCbm = 0;
    let trackingCount = 0;
    for (const item of invoice.items || []) {
      const d = item.details || {};
      // Preferir el CBM facturado si está presente
      if (d.billed_cbm !== undefined) totalCbm += num(d.billed_cbm);
      else if (d.cbm !== undefined) totalCbm += num(d.cbm);
      if (d.package_count !== undefined) trackingCount = num(d.package_count);
    }
    totalCbm = Math.round(totalCbm * 10000) / 10000;

    const DOOR_TO_DOOR_THRESHOLD = 0.130;

    // Tarifas especiales del proveedor para cargas < 0.130 CBM (monto fijo por rango)
    const specialRates = (Array.isArray(cfg.provider_special_cbm_rates) ? cfg.provider_special_cbm_rates : [])
      .slice().sort((x, y) => num(x.min_cbm) - num(y.min_cbm));

    let providerCost;
    let baseCost;
    const breakdown = [];

    if (totalCbm > 0 && totalCbm < DOOR_TO_DOOR_THRESHOLD) {
      // Carga pequeña: usar tarifa especial fija del proveedor según rango de CBM
      const found = specialRates.find((r) => totalCbm <= num(r.max_cbm));
      const specialCost = found ? (isHighRisk ? num(found.rate_high_risk) : num(found.rate_regular)) : 0;
      baseCost = specialCost;
      breakdown.push({ concepto: `Tarifa especial proveedor (${totalCbm} CBM ${isHighRisk ? 'Alto Riesgo' : 'Regular'})`, costo: Math.round(specialCost * 100) / 100 });
    } else {
      // Carga >= 0.130 CBM: (tarifa base + tarifa de envío del estado) × CBM + puerta a puerta
      const perCbm = baseRate + stateShippingRate;
      const cbmCost = perCbm * totalCbm;
      const trackingCost = perTracking * trackingCount;
      baseCost = cbmCost + doorToDoor + trackingCost;
      breakdown.push(
        { concepto: `Tarifa base ${isHighRisk ? 'Alto Riesgo' : 'Regular'} × ${totalCbm} CBM`, costo: Math.round(baseRate * totalCbm * 100) / 100 },
        { concepto: `Tarifa de envío (${stateCode || 'sin estado'}) × ${totalCbm} CBM`, costo: Math.round(stateShippingRate * totalCbm * 100) / 100 },
        { concepto: 'Costo puerta a puerta', costo: Math.round(doorToDoor * 100) / 100 },
        { concepto: `Por tracking ($${perTracking} × ${trackingCount})`, costo: Math.round(trackingCost * 100) / 100 },
      );
    }

    // Cargo por consolidación (% sobre el costo base)
    const consolidationFee = baseCost * (consolidationFeePct / 100);
    if (consolidationFeePct > 0) {
      breakdown.push({ concepto: `Cargo por consolidación (${consolidationFeePct}%)`, costo: Math.round(consolidationFee * 100) / 100 });
    }
    providerCost = baseCost + consolidationFee;

    providerCost = Math.round(providerCost * 100) / 100;
    const profit = Math.round((num(invoice.total) - providerCost) * 100) / 100;

    // Crear cuenta por pagar al proveedor
    const ap = await base44.asServiceRole.entities.AccountsPayable.create({
      vendor_name: provider.name || 'Proveedor Logística Marítima',
      shipping_provider_id: provider.id || '',
      description: `Costo proveedor - Factura ${invoice.invoice_number || invoice.id} (${invoice.client_email})`,
      original_amount_due: providerCost,
      balance_due: providerCost,
      amount_paid: 0,
      status: 'pendiente',
      currency: 'USD',
      category: 'flete_maritimo',
      account_code: provider.account_code || '501-01 Fletes',
      cost_center: provider.cost_center || 'Operaciones',
      related_consolidation_id: invoice.consolidation_id || '',
      invoice_from_vendor_url: providerInvoiceUrl || invoice.provider_invoice_url || '',
      risk_level: isHighRisk ? 'alto' : 'regular',
      state_code: stateCode || '',
      cbm: Math.round(totalCbm * 10000) / 10000,
      tracking_count: trackingCount,
      consolidation_fee_percentage_applied: consolidationFeePct,
      consolidation_fee_amount: Math.round(consolidationFee * 100) / 100
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