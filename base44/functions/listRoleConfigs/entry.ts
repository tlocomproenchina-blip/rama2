import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { ROLE_PRESETS } from '../../shared/roleAreas.ts';

// Lista todas las configuraciones de roles (RoleConfig) desde el backend.
// Usa asServiceRole para evitar restricciones de permisos.
// Devuelve un mapa { role_code: config } con los presets aplicados como fallback.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
    }

    const configRows = await base44.asServiceRole.entities.RoleConfig.list('-updated_date', 100);

    const configs = {};
    Object.keys(ROLE_PRESETS).forEach((code) => {
      configs[code] = {
        role_code: code,
        ...ROLE_PRESETS[code],
        visible_pages: ROLE_PRESETS[code].visible_pages || [],
        is_active: true,
      };
    });

    (configRows || []).forEach((row) => {
      if (row?.role_code && configs[row.role_code]) {
        configs[row.role_code] = {
          ...configs[row.role_code],
          ...row,
          visible_pages: Array.isArray(row.visible_pages) ? row.visible_pages : configs[row.role_code].visible_pages,
        };
      }
    });

    return Response.json({ configs });
  } catch (error) {
    console.error('listRoleConfigs error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});