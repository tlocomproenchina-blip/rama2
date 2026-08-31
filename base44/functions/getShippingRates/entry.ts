import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    // Endpoint público — sin auth. Usamos service role para leer config y estados.
    const [states, configs, pricingConfigs] = await Promise.all([
      base44.asServiceRole.entities.StateConfig.filter({ is_active: true }, 'state_name'),
      base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1),
      base44.asServiceRole.entities.PricingConfig.filter({ config_key: 'main' }, '-updated_date', 1)
    ]);

    const config = configs[0] || {};
    const pricing = pricingConfigs[0] || {};

    // Tarifas base y cálculo global (igual que la página Rates.jsx)
    const baseRegular = pricing.base_rate_regular || 0;
    const baseHigh = pricing.base_rate_high_risk || 0;
    const profitPct = pricing.profit_percentage || 0;
    const doorToDoor = pricing.door_to_door_cost || 0;

    const globalFinalRegular = baseRegular * (1 + profitPct / 100) + doorToDoor;
    const globalFinalHigh = baseHigh * (1 + profitPct / 100) + doorToDoor;

    // Estados: Precio final Regular y Precio final Alto riesgo
    const estados = (states || []).map((s) => {
      const shippingRate = s.shipping_rate || 0;
      // Si el estado tiene final_rate definido (>0), se usa ese valor directo
      const regular = s.final_rate_regular && s.final_rate_regular > 0
        ? s.final_rate_regular
        : (baseRegular * (1 + profitPct / 100) + shippingRate + doorToDoor);
      const high = s.final_rate_high && s.final_rate_high > 0
        ? s.final_rate_high
        : (baseHigh * (1 + profitPct / 100) + shippingRate + doorToDoor);
      return {
        name: s.state_name,
        rate_cbm: Number(regular.toFixed(2)),
        rate_cbm_high_risk: Number(high.toFixed(2))
      };
    });

    const tipos_carga = [
      { key: 'maritimo_regular', label: 'Marítimo Regular' },
      { key: 'maritimo_alto_riesgo', label: 'Marítimo Alto Riesgo' }
    ];

    return Response.json({
      estados,
      tipos_carga,
      base_rate_regular: baseRegular,
      base_rate_high_risk: baseHigh,
      profit_percentage: profitPct,
      door_to_door_cost: doorToDoor,
      global_final_regular: Number(globalFinalRegular.toFixed(2)),
      global_final_high_risk: Number(globalFinalHigh.toFixed(2)),
      updated_date: config.updated_date || null
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}