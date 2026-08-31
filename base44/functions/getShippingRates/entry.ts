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

    // Tarifas globales de fallback desde AppConfig
    const globalRegular = config.rate_sea_general || 0;
    const globalHigh = config.rate_sea_sensitive || 0;

    // Estados: usamos final_rate_regular y final_rate_high de cada estado.
  // Si el estado tiene 0 en final_rate, caemos al global de AppConfig.
    const estados = (states || []).map((s) => {
      const regular = s.final_rate_regular && s.final_rate_regular > 0
        ? s.final_rate_regular
        : globalRegular;
      const high = s.final_rate_high && s.final_rate_high > 0
        ? s.final_rate_high
        : globalHigh;
      return {
        name: s.state_name,
        rate_cbm: regular,
        rate_cbm_high_risk: high
      };
    });

    // Tipos de carga marítima
    const tipos_carga = [
      { key: 'maritimo_regular', label: 'Marítimo Regular' },
      { key: 'maritimo_alto_riesgo', label: 'Marítimo Alto Riesgo' }
    ];

    return Response.json({
      estados,
      tipos_carga,
      rate_sea_general: globalRegular,
      rate_sea_sensitive: globalHigh,
      updated_date: config.updated_date || null
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}