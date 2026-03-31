import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// calculateCbmQuote
// Input JSON:
// {
//   categoria_carga: "general"|"sensible"|"electronica_bateria"|"marca_repllica",
//   largo?: number, ancho?: number, alto?: number, cantidad?: number,
//   units?: "cm"|"m", // default: "cm"
//   cbm?: number, // si viene, se usa directo
//   add_door_to_door?: boolean, // default true
//   include_insurance?: boolean, // si true y viene fob_value, calcular
//   fob_value?: number
// }
// Regla de negocio confirmada por el usuario:
// - Tarifas desde PricingConfig: base_rate_regular, base_rate_high_risk, door_to_door_cost
// - Mínimo facturable: 0.130 CBM
// - Seguro: preguntar primero; si include_insurance=true y hay fob_value, usar (AppConfig.insurance_percentage || 5)%

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      categoria_carga,
      largo,
      ancho,
      alto,
      cantidad = 1,
      units = 'cm',
      cbm: cbmInput,
      add_door_to_door = true,
      include_insurance = false,
      fob_value
    } = body || {};

    if (!categoria_carga) {
      return Response.json({ error: 'Falta categoria_carga' }, { status: 400 });
    }

    // 1) Obtener configuración de precios
    const pricingCfgList = await base44.entities.PricingConfig.filter({ config_key: 'main' });
    const pricing = pricingCfgList[0] || {};
    const base_rate_regular = Number(pricing.base_rate_regular ?? 690);
    const base_rate_high_risk = Number(pricing.base_rate_high_risk ?? 790);
    const door_to_door_cost = Number(pricing.door_to_door_cost ?? 20);

    // 2) Obtener configuración de seguro (opcional)
    const appCfgList = await base44.entities.AppConfig.filter({ config_key: 'main' });
    const appCfg = appCfgList[0] || {};
    const insurance_pct = Number(appCfg.insurance_percentage ?? 5);

    // 3) Calcular CBM
    let cbm = 0;
    if (typeof cbmInput === 'number' && !Number.isNaN(cbmInput)) {
      cbm = Math.max(0, cbmInput);
    } else {
      if ([largo, ancho, alto].some(v => typeof v !== 'number' || Number.isNaN(v))) {
        return Response.json({ error: 'Faltan dimensiones (largo, ancho, alto) o cbm' }, { status: 400 });
      }
      const l = Number(largo), a = Number(ancho), h = Number(alto);
      const perUnit = units === 'm' ? (l * a * h) : ((l * a * h) / 1_000_000);
      cbm = perUnit * Number(cantidad || 1);
    }

    // 4) Aplicar mínimo facturable
    const MIN_CBM = 0.130;
    const billable_cbm = Math.max(cbm, MIN_CBM);

    // 5) Seleccionar tarifa base
    const highRiskCats = new Set(['sensible', 'electronica_bateria', 'marca_repllica']);
    const base_rate_type = highRiskCats.has(String(categoria_carga)) ? 'high_risk' : 'regular';
    const base_rate = base_rate_type === 'regular' ? base_rate_regular : base_rate_high_risk;

    // 6) Subtotales
    const freight_subtotal = billable_cbm * base_rate;
    const d2d = add_door_to_door ? door_to_door_cost : 0;

    // 7) Seguro (solo si el usuario lo confirma)
    let insurance = 0;
    let ask_insurance = false;
    if (include_insurance) {
      if (typeof fob_value === 'number' && fob_value > 0) {
        insurance = (insurance_pct / 100) * fob_value;
      } else {
        // Falta FOB; pedirlo
        ask_insurance = true;
      }
    } else {
      // Aún no autorizado por el usuario; sugerir pregunta
      ask_insurance = true;
    }

    const subtotal = freight_subtotal + d2d;
    const total = subtotal + insurance;

    return Response.json({
      input: {
        categoria_carga,
        largo,
        ancho,
        alto,
        cantidad,
        units,
        cbm_input: cbmInput,
        add_door_to_door,
        include_insurance,
        fob_value
      },
      pricing: {
        base_rate_type,
        base_rate,
        door_to_door_cost,
        insurance_percentage: insurance_pct
      },
      results: {
        cbm: Number(cbm.toFixed(6)),
        billable_cbm: Number(billable_cbm.toFixed(6)),
        freight_subtotal: Number(freight_subtotal.toFixed(2)),
        door_to_door: Number(d2d.toFixed(2)),
        insurance: Number(insurance.toFixed(2)),
        subtotal: Number(subtotal.toFixed(2)),
        total: Number(total.toFixed(2))
      },
      ask_insurance
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
});