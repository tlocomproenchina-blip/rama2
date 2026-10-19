import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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
// Reglas de negocio:
// - SIN mínimo facturable de CBM: se cobra el volumen real, sin tarifa fija por rango.
// - Cargo fijo de $1 por recepción de paquete (siempre).
// - Servicio puerta a puerta (tarifas por CBM de PricingConfig + door_to_door_cost).
// - Seguro: si include_insurance=true y hay fob_value, usar (AppConfig.insurance_percentage || 5)%

const PACKAGE_RECEIVED_FEE = 1;

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

    // 1) Configuraciones
    const [pricingCfgList, appCfgList] = await Promise.all([
      base44.entities.PricingConfig.filter({ config_key: 'main' }),
      base44.entities.AppConfig.filter({ config_key: 'main' })
    ]);
    const pricing = pricingCfgList[0] || {};
    const appCfg = appCfgList[0] || {};

    const base_rate_regular = Number(pricing.base_rate_regular ?? 690);
    const base_rate_high_risk = Number(pricing.base_rate_high_risk ?? 790);
    const door_to_door_cost = Number(pricing.door_to_door_cost ?? 20);
    const insurance_pct = Number(appCfg.insurance_percentage ?? 5);

    // 2) Calcular CBM
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

    if (cbm <= 0) {
      return Response.json({ error: 'El CBM debe ser mayor a 0' }, { status: 400 });
    }

    // 3) Categoría de riesgo
    const highRiskCats = new Set(['sensible', 'electronica_bateria', 'marca_repllica', 'alto_riesgo']);
    const base_rate_type = highRiskCats.has(String(categoria_carga)) ? 'high_risk' : 'regular';

    // 4) Cálculo según umbral de CBM
    let freight_subtotal = 0;
    let d2d = 0;
    let base_rate = 0;
    let service_type;
    let service_notes;

    // Servicio puerta a puerta: se cobra el volumen real, sin mínimo ni tarifa fija por rango.
    base_rate = base_rate_type === 'regular' ? base_rate_regular : base_rate_high_risk;
    freight_subtotal = cbm * base_rate;
    d2d = add_door_to_door ? door_to_door_cost : 0;
    service_type = 'puerta_a_puerta';
    service_notes = 'Incluye servicio puerta a puerta en la dirección del cliente.';

    // 5) Cargo fijo por recepción de paquete
    const reception_fee = PACKAGE_RECEIVED_FEE;

    // 6) Seguro (solo si el usuario lo confirma)
    let insurance = 0;
    let ask_insurance = false;
    if (include_insurance) {
      if (typeof fob_value === 'number' && fob_value > 0) {
        insurance = (insurance_pct / 100) * fob_value;
      } else {
        ask_insurance = true;
      }
    } else {
      ask_insurance = true;
    }

    const subtotal = freight_subtotal + d2d + reception_fee;
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
        reception_fee,
        insurance_percentage: insurance_pct
      },
      results: {
        cbm: Number(cbm.toFixed(6)),
        billable_cbm: Number(cbm.toFixed(6)),
        freight_subtotal: Number(freight_subtotal.toFixed(2)),
        door_to_door: Number(d2d.toFixed(2)),
        reception_fee: Number(reception_fee.toFixed(2)),
        insurance: Number(insurance.toFixed(2)),
        subtotal: Number(subtotal.toFixed(2)),
        total: Number(total.toFixed(2))
      },
      service_type,
      service_notes,
      ask_insurance
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
});