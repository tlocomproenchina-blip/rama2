import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const configs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });
    const cfg = configs?.[0] || {};

    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const doorToDoor = num(cfg.provider_door_to_door_cost);
    const DOOR_TO_DOOR_THRESHOLD = 0.130;
    const specialRates = (Array.isArray(cfg.provider_special_cbm_rates) ? cfg.provider_special_cbm_rates : [])
      .slice().sort((x, y) => num(x.min_cbm) - num(y.min_cbm));

    // Cache de tarifas por estado y datos de usuario para no repetir lecturas
    const stateRateCache = {};
    const getStateRate = async (stateCode) => {
      if (!stateCode) return 0;
      if (stateRateCache[stateCode] !== undefined) return stateRateCache[stateCode];
      const states = await base44.asServiceRole.entities.StateConfig.filter({ state_code: stateCode });
      const rate = num(states?.[0]?.shipping_rate);
      stateRateCache[stateCode] = rate;
      return rate;
    };

    const userCache = {};
    const getUser = async (email) => {
      if (userCache[email] !== undefined) return userCache[email];
      const users = await base44.asServiceRole.entities.User.filter({ email });
      const u = users?.[0] || {};
      userCache[email] = u;
      return u;
    };

    // Solo facturas manuales (prefijo INV-M-)
    const allInvoices = await base44.asServiceRole.entities.Invoice.list('-created_date', 1000);
    const manualInvoices = allInvoices.filter((inv) => (inv.invoice_number || '').startsWith('INV-M-'));

    let updatedCount = 0;
    let skippedNoAp = 0;

    for (const invoice of manualInvoices) {
      const clientUser = await getUser(invoice.client_email);
      const stateCode = String(clientUser.state || '').trim().toLowerCase();
      const isHighRisk = String(clientUser.risk_category || '').toLowerCase().includes('alto');
      const stateShippingRate = await getStateRate(stateCode);
      const baseRate = isHighRisk ? num(cfg.provider_rate_sea_sensitive) : num(cfg.provider_rate_sea_general);

      let totalCbm = 0;
      let trackingCount = 0;
      for (const item of invoice.items || []) {
        const d = item.details || {};
        if (d.billed_cbm !== undefined) totalCbm += num(d.billed_cbm);
        else if (d.cbm !== undefined) totalCbm += num(d.cbm);
        if (d.package_count !== undefined) trackingCount = num(d.package_count);
      }
      totalCbm = Math.round(totalCbm * 10000) / 10000;

      // Mismo cálculo que processInvoiceForAccounting
      let providerCost;
      if (totalCbm > 0 && totalCbm < DOOR_TO_DOOR_THRESHOLD) {
        const found = specialRates.find((r) => totalCbm <= num(r.max_cbm));
        providerCost = found ? (isHighRisk ? num(found.rate_high_risk) : num(found.rate_regular)) : 0;
      } else {
        const perCbm = baseRate + stateShippingRate;
        providerCost = perCbm * totalCbm + doorToDoor;
      }
      providerCost = Math.round(providerCost * 100) / 100;
      const profit = Math.round((num(invoice.total) - providerCost) * 100) / 100;

      // Buscar la cuenta por pagar asociada (por descripción que incluye el número de factura)
      const invRef = invoice.invoice_number || invoice.id;
      const aps = await base44.asServiceRole.entities.AccountsPayable.filter({
        description: `Costo proveedor - Factura ${invRef} (${invoice.client_email})`
      });
      const ap = aps?.[0];

      if (ap) {
        const newPaid = num(ap.amount_paid);
        const newBalance = Math.max(providerCost - newPaid, 0);
        const newStatus = newBalance === 0 ? (providerCost > 0 ? 'pagado' : 'pendiente') : (newPaid > 0 ? 'parcial' : 'pendiente');
        await base44.asServiceRole.entities.AccountsPayable.update(ap.id, {
          original_amount_due: providerCost,
          balance_due: newBalance,
          status: newStatus,
          state_code: stateCode || undefined,
          cbm: totalCbm,
          tracking_count: trackingCount
        });
      } else {
        skippedNoAp++;
      }

      await base44.asServiceRole.entities.Invoice.update(invoice.id, {
        provider_cost_total: providerCost,
        profit_amount: profit
      });
      updatedCount++;
    }

    return Response.json({
      success: true,
      manual_invoices_processed: manualInvoices.length,
      updated: updatedCount,
      without_accounts_payable: skippedNoAp
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});