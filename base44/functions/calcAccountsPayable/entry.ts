import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function toNumber(n, def = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
}

async function getPricingConfig(base44) {
  const list = await base44.asServiceRole.entities.PricingConfig.filter({ config_key: 'main' });
  return list[0] || (await base44.asServiceRole.entities.PricingConfig.list())[0] || {};
}

async function getStateRate(base44, stateCode) {
  if (!stateCode) return 0;
  const code = String(stateCode).trim().toLowerCase();
  const states = await base44.asServiceRole.entities.StateConfig.filter({ state_code: code });
  const st = states[0];
  return toNumber(st?.shipping_rate, 0);
}

async function getDefaultMaritimeProvider(base44) {
  const list = await base44.asServiceRole.entities.ShippingProvider.filter({ mode: 'maritimo', is_active: true });
  const defaults = list.filter(p => p.is_default_for_mode);
  return defaults[0] || list[0] || null;
}

async function getProviderStateRate(base44, provider, stateCode) {
  if (!provider || !stateCode) return null;
  const code = String(stateCode).trim().toLowerCase();
  const override = (provider.state_overrides || []).find(o => (o.state_code || '').toLowerCase() === code);
  if (override && typeof override.shipping_rate === 'number') return override.shipping_rate;
  return null;
}

function pickStateFromConsolidation(cons) {
  return (
    cons?.destination_state ||
    cons?.state ||
    cons?.delivery_state ||
    cons?.client_state ||
    null
  );
}

async function getClientState(base44, email) {
  if (!email) return null;
  try {
    const users = await base44.asServiceRole.entities.User.filter({ email });
    const u = users[0];
    return u?.state || null;
  } catch {
    return null;
  }
}

async function ensureOrUpdateAP(base44, cons, providerTotal, breakdown, vendorName, providerId, consolidationFeePercentageApplied, consolidationFeeAmount) {

  const existing = await base44.asServiceRole.entities.AccountsPayable.filter({
    related_consolidation_id: cons.id,
    category: 'flete_maritimo'
  });

  if (existing.length > 0) {
    const ap = existing[0];
    const amountPaid = toNumber(ap.amount_paid, 0);
    const newBalance = Math.max(providerTotal - amountPaid, 0);
    const newStatus = newBalance === 0 ? 'pagado' : amountPaid > 0 ? 'parcial' : 'pendiente';

    const updated = await base44.asServiceRole.entities.AccountsPayable.update(ap.id, {
      original_amount_due: providerTotal,
      balance_due: newBalance,
      status: newStatus,
      shipping_provider_id: providerId,
      consolidation_fee_percentage_applied: consolidationFeePercentageApplied,
      consolidation_fee_amount: consolidationFeeAmount,
      cbm: breakdown.cbm,
      tracking_count: breakdown.tracking_count,
      risk_level: breakdown.risk_level,
      state_code: breakdown.state_code,
      description: `Flete marítimo consolidación ${cons.consolidation_tracking || cons.id}`
    });
    return { action: 'updated', ap: updated };
  }

  const created = await base44.asServiceRole.entities.AccountsPayable.create({
    vendor_name: vendorName,
    shipping_provider_id: providerId,
    description: `Flete marítimo consolidación ${cons.consolidation_tracking || cons.id}`,
    original_amount_due: providerTotal,
    currency: 'USD',
    status: 'pendiente',
    amount_paid: 0,
    balance_due: providerTotal,
    related_consolidation_id: cons.id,
    category: 'flete_maritimo',
    account_code: '501-01 Fletes',
    cost_center: 'Operaciones',
    cbm: breakdown.cbm,
    tracking_count: breakdown.tracking_count,
    risk_level: breakdown.risk_level,
    state_code: breakdown.state_code,
    consolidation_fee_percentage_applied: consolidationFeePercentageApplied,
    consolidation_fee_amount: consolidationFeeAmount
  });
  return { action: 'created', ap: created };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let body = {};
    try { body = await req.json(); } catch {}

    // Strict auth: payload fields (e.g. event.entity_name) are attacker-controlled
    // and must never be used to bypass authentication. Admin only.
    let user = null;
    try { user = await base44.auth.me(); } catch { user = null; }
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const isAutomation = !!body?.event && body?.event?.entity_name === 'Consolidation';

    // Get consolidation
    let cons = null;
    if (isAutomation) {
      cons = body?.data;
      if (!cons || body?.payload_too_large) {
        const id = body?.event?.entity_id;
        if (!id) return Response.json({ error: 'Missing consolidation id in automation payload' }, { status: 400 });
        cons = await base44.asServiceRole.entities.Consolidation.get(id);
      }

      // Only trigger when transitioning into en_transito unless forced
      const oldStatus = body?.old_data?.status;
      const newStatus = cons?.status;
      const force = body?.force === true;
      if (!force && !(oldStatus !== 'en_transito' && newStatus === 'en_transito')) {
        return Response.json({ skipped: true, reason: 'No status transition to en_transito' });
      }
    } else {
      const consId = body?.consolidation_id;
      if (!consId) return Response.json({ error: 'consolidation_id is required' }, { status: 400 });
      cons = await base44.asServiceRole.entities.Consolidation.get(consId);
    }

    // Inputs from consolidation/config
    const pricing = await getPricingConfig(base44);
    const isHigh = (cons?.risk_level || 'regular') === 'alto';
    const cbm = toNumber(cons?.cbm, 0);

    const provider = await getDefaultMaritimeProvider(base44);

    // Base rates (provider override -> pricing fallback)
    const baseRate = toNumber(
      isHigh ? (provider?.base_rate_high_risk ?? pricing?.base_rate_high_risk) : (provider?.base_rate_regular ?? pricing?.base_rate_regular),
      0
    );

    // Door-to-door cost
    const d2d = toNumber(provider?.door_to_door_cost ?? pricing?.door_to_door_cost, 20);

    // State rate (provider override -> StateConfig)
    let stateCode = pickStateFromConsolidation(cons);
    if (!stateCode) stateCode = await getClientState(base44, cons?.client_email);
    const providerState = await getProviderStateRate(base44, provider, stateCode);
    const stateRate = providerState != null ? toNumber(providerState, 0) : await getStateRate(base44, stateCode);

    // Per-tracking (configurable by risk, default 1)
    const perTracking = toNumber(isHigh ? (provider?.per_tracking_high ?? 1) : (provider?.per_tracking_regular ?? 1), 1);

    const trackingCount = Array.isArray(cons?.tracking_numbers)
      ? cons.tracking_numbers.length
      : Array.isArray(cons?.package_ids)
        ? cons.package_ids.length
        : 0;

    // Provider formula: baseRate + stateRate + D2D + (perTracking × #trackings), multiplied by CBM
    const unitTotal = baseRate + stateRate + d2d + trackingCount * perTracking;
    const cbmMultiplier = cbm > 0 ? cbm : 1; // fallback to 1 if no CBM provided
    const subtotalBeforeConsolidation = toNumber(unitTotal * cbmMultiplier, 0);
    const consolidationFeePercentageApplied = toNumber(provider?.consolidation_fee_percentage, 0);
    const consolidationFeeAmount = toNumber(subtotalBeforeConsolidation * (consolidationFeePercentageApplied / 100), 0);
    const providerTotal = toNumber(subtotalBeforeConsolidation + consolidationFeeAmount, 0);

    const breakdown = {
      cbm,
      tracking_count: trackingCount,
      risk_level: isHigh ? 'alto' : 'regular',
      state_code: stateCode || null
    };

    const vendorName = provider?.name || 'Proveedor Logística Marítima';
    const result = await ensureOrUpdateAP(
      base44,
      cons,
      providerTotal,
      breakdown,
      vendorName,
      provider?.id || null,
      consolidationFeePercentageApplied,
      consolidationFeeAmount
    );

    return Response.json({
      success: true,
      provider_total: providerTotal,
      subtotal_before_consolidation: subtotalBeforeConsolidation,
      consolidation_fee_percentage_applied: consolidationFeePercentageApplied,
      consolidation_fee_amount: consolidationFeeAmount,
      ...result
    });
  } catch (error) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});