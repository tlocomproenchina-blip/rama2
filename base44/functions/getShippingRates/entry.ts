import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    // Endpoint público — sin auth. Usamos service role para leer config y estados.
    const [states, configs] = await Promise.all([
      base44.asServiceRole.entities.StateConfig.filter({ is_active: true }, 'state_name'),
      base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1)
    ]);

    const config = configs[0] || {};

    // Tarifas base de AppConfig
    const rateSeaGeneral = config.rate_sea_general || 0;
    const rateSeaSensitive = config.rate_sea_sensitive || 0;

    // Estados: rate_cbm = shipping_rate del estado (tarifa por CBM marítimo regular)
    const estados = (states || []).map((s) => ({
      name: s.state_name,
      rate_cbm: s.shipping_rate || 0
    }));

    // Tipos de carga marítima: multiplier relativo a la tarifa regular
    const tipos_carga = [
      {
        key: 'maritimo_regular',
        label: 'Marítimo Regular',
        multiplier: 1
      },
      {
        key: 'maritimo_alto_riesgo',
        label: 'Marítimo Alto Riesgo',
        multiplier: rateSeaGeneral > 0 ? rateSeaSensitive / rateSeaGeneral : 1
      }
    ];

    return Response.json({
      estados,
      tipos_carga,
      rate_sea_general: rateSeaGeneral,
      rate_sea_sensitive: rateSeaSensitive,
      updated_date: config.updated_date || null
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}