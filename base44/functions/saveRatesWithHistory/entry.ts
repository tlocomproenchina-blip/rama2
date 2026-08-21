import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// saveRatesWithHistory
// Input JSON:
// {
//   pricing: { base_rate_regular, base_rate_high_risk, profit_percentage, door_to_door_cost, is_door_to_door_optional },
//   special_cbm_rates: [ { min_cbm, max_cbm, rate_regular, rate_high_risk } ],
//   effective_date: "YYYY-MM-DD"  // fecha desde la cual rigen las nuevas tarifas (default: hoy)
// }
//
// 1. Si no existe historial previo, backfill con las tarifas actuales y fecha centinela 2000-01-01.
// 2. Archiva las nuevas tarifas en RateHistory con la effective_date elegida.
// 3. Actualiza PricingConfig y AppConfig.special_cbm_rates con los nuevos valores.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { pricing = {}, special_cbm_rates, effective_date } = body || {};

    const effDate = effective_date || new Date().toISOString().slice(0, 10);
    if (!pricing || typeof pricing !== 'object') {
      return Response.json({ error: 'Falta el objeto pricing' }, { status: 400 });
    }

    // Cargar configuración actual
    const [pricingList, appList] = await Promise.all([
      base44.entities.PricingConfig.filter({ config_key: 'main' }),
      base44.entities.AppConfig.filter({ config_key: 'main' })
    ]);
    const currentPricing = pricingList[0] || {};
    const currentApp = appList[0] || {};
    const currentSpecial = Array.isArray(currentApp.special_cbm_rates) ? currentApp.special_cbm_rates : [];

    // Verificar si ya existe historial
    const existingHistory = await base44.entities.RateHistory.list('-effective_date', 200);

    // Backfill: si no hay historial, archivar las tarifas actuales con fecha centinela
    if (!existingHistory || existingHistory.length === 0) {
      await base44.entities.RateHistory.create({
        effective_date: '2000-01-01',
        base_rate_regular: Number(currentPricing.base_rate_regular ?? 690),
        base_rate_high_risk: Number(currentPricing.base_rate_high_risk ?? 790),
        profit_percentage: Number(currentPricing.profit_percentage ?? 10),
        door_to_door_cost: Number(currentPricing.door_to_door_cost ?? 20),
        special_cbm_rates: currentSpecial,
        is_backfill: true,
        created_by_email: user.email
      });
    }

    // Archivar las nuevas tarifas con la effective_date elegida
    const newSpecial = Array.isArray(special_cbm_rates) ? special_cbm_rates : currentSpecial;
    await base44.entities.RateHistory.create({
      effective_date: effDate,
      base_rate_regular: Number(pricing.base_rate_regular ?? 0),
      base_rate_high_risk: Number(pricing.base_rate_high_risk ?? 0),
      profit_percentage: Number(pricing.profit_percentage ?? 0),
      door_to_door_cost: Number(pricing.door_to_door_cost ?? 0),
      special_cbm_rates: newSpecial,
      is_backfill: false,
      created_by_email: user.email
    });

    // Actualizar PricingConfig
    const pricingPayload = {
      base_rate_regular: Number(pricing.base_rate_regular ?? 0),
      base_rate_high_risk: Number(pricing.base_rate_high_risk ?? 0),
      profit_percentage: Number(pricing.profit_percentage ?? 0),
      door_to_door_cost: Number(pricing.door_to_door_cost ?? 0),
      is_door_to_door_optional: pricing.is_door_to_door_optional !== false,
      rate_effective_date: effDate,
      config_key: 'main'
    };
    if (pricingList.length > 0) {
      await base44.entities.PricingConfig.update(currentPricing.id, pricingPayload);
    } else {
      await base44.entities.PricingConfig.create(pricingPayload);
    }

    // Actualizar AppConfig.special_cbm_rates (sin sobrescribir los demás campos)
    if (appList.length > 0) {
      await base44.entities.AppConfig.update(currentApp.id, {
        special_cbm_rates: newSpecial,
        config_key: 'main'
      });
    } else {
      await base44.entities.AppConfig.create({
        config_key: 'main',
        special_cbm_rates: newSpecial
      });
    }

    return Response.json({ status: 'ok', effective_date: effDate });
  } catch (error) {
    return Response.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
});