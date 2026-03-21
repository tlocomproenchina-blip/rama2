import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

function toSafeString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function toSafeNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed);
}

const AREA_ROLE_LABELS = {
  operaciones: 'Operaciones',
  almacen: 'Almacén',
  contabilidad: 'Contabilidad',
  soporte: 'Soporte',
  marketing: 'Marketing',
  logistica: 'Logística',
  comunicaciones: 'Comunicaciones',
  seguimiento: 'Seguimiento',
  equipo_y_acceso: 'Equipo y Acceso',
};

function getActorRoleLabel(user) {
  if (user?.role === 'user') return 'cliente';
  if (user?.role === 'admin') return 'admin';
  return toSafeString(user?.role, 'user');
}

function getAreaLabel(user) {
  if (user?.role === 'user') return 'Cliente';
  const customRole = toSafeString(user?.custom_role);
  return AREA_ROLE_LABELS[customRole.toLowerCase()] || customRole || 'Administrador';
}

function getAreaCode(user) {
  if (user?.role === 'user') return 'cliente';
  return toSafeString(user?.custom_role, 'admin');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const actorName = user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;

    const log = await base44.asServiceRole.entities.EmployeeAuditLog.create({
      actor_email: user.email,
      actor_name: actorName,
      actor_role: getActorRoleLabel(user),
      target_email: toSafeString(payload.target_email, user.email),
      target_name: toSafeString(payload.target_name, actorName),
      action_type: toSafeString(payload.action_type, 'activity_event'),
      activity_kind: toSafeString(payload.activity_kind, 'manual_action'),
      module_name: toSafeString(payload.module_name, payload.page_name || 'General'),
      page_name: toSafeString(payload.page_name, payload.module_name || ''),
      page_path: toSafeString(payload.page_path),
      reference_id: toSafeString(payload.reference_id),
      area_code: toSafeString(payload.area_code, getAreaCode(user)),
      area_name: toSafeString(payload.area_name, getAreaLabel(user)),
      session_id: toSafeString(payload.session_id),
      duration_ms: toSafeNumber(payload.duration_ms),
      active_time_ms: toSafeNumber(payload.active_time_ms),
      idle_time_ms: toSafeNumber(payload.idle_time_ms),
      client_side_timestamp: toSafeString(payload.client_side_timestamp, new Date().toISOString()),
      summary: toSafeString(payload.summary, 'Actividad registrada'),
      details: toSafeString(payload.details),
      changed_fields: Array.isArray(payload.changed_fields) ? payload.changed_fields.map((item) => String(item)).slice(0, 20) : [],
      metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {},
    });

    return Response.json({ ok: true, log_id: log?.id || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});