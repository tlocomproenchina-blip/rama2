import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    const configs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });
    const config = (configs && configs[0]) || {};

    return Response.json({
      enabled: !!config.battery_banner_enabled,
      start_date: config.battery_banner_start_date || null,
      end_date: config.battery_banner_end_date || null,
      title: config.battery_banner_title || '',
      html: config.battery_banner_html || '',
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}