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
    const seaRate = num(cfg.provider_rate_sea_general);
    const insurancePct = num(cfg.provider_insurance_percentage);
    const receptionFee = num(cfg.provider_reception_fee);
    const specialRanges = Array.isArray(cfg.provider_special_cbm_rates) ? cfg.provider_special_cbm_rates : [];

    const computeProviderCost = (invoice) => {
      let providerCost = 0;
      let totalCbm = 0;
      let trackingCount = 0;
      for (const item of invoice.items || []) {
        const d = item.details || {};
        if (d.cbm !== undefined) {
          const cbm = num(d.cbm);
          totalCbm += cbm;
          const range = cbm > 0 && cbm < 0.13
            ? specialRanges.find((r) => cbm >= num(r.min_cbm) && cbm <= num(r.max_cbm))
            : null;
          providerCost += range ? num(range.rate_regular) : cbm * seaRate;
        } else if (d.fob_value !== undefined) {
          providerCost += num(d.fob_value) * insurancePct / 100;
        } else if (d.package_count !== undefined) {
          trackingCount = num(d.package_count);
          providerCost += trackingCount * receptionFee;
        }
      }
      return {
        providerCost: Math.round(providerCost * 100) / 100,
        totalCbm: Math.round(totalCbm * 10000) / 10000,
        trackingCount
      };
    };

    // Solo facturas manuales (prefijo INV-M-)
    const allInvoices = await base44.asServiceRole.entities.Invoice.list('-created_date', 1000);
    const manualInvoices = allInvoices.filter((inv) => (inv.invoice_number || '').startsWith('INV-M-'));

    let updatedCount = 0;
    let skippedNoAp = 0;

    for (const invoice of manualInvoices) {
      const { providerCost, totalCbm, trackingCount } = computeProviderCost(invoice);
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