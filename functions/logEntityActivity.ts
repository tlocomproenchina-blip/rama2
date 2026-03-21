import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const IGNORED_FIELDS = new Set(['id', 'created_date', 'updated_date', 'created_by']);
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

function stringifyValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function getEntityLabel(entityName, data) {
  return data?.tracking_number ||
    data?.codigo_ruta ||
    data?.consolidation_tracking ||
    data?.ticket_number ||
    data?.invoice_number ||
    data?.shipping_mark ||
    data?.name ||
    data?.title ||
    data?.subject ||
    entityName ||
    'Registro';
}

function getChangedFields(oldData, newData, actionType) {
  if (actionType === 'create') {
    return Object.entries(newData || {})
      .filter(([field]) => !IGNORED_FIELDS.has(field))
      .map(([field, value]) => ({ field_name: field, old_value: '—', new_value: stringifyValue(value) }))
      .slice(0, 20);
  }

  if (actionType === 'delete') {
    return Object.entries(oldData || {})
      .filter(([field]) => !IGNORED_FIELDS.has(field))
      .map(([field, value]) => ({ field_name: field, old_value: stringifyValue(value), new_value: '—' }))
      .slice(0, 20);
  }

  const fields = new Set([
    ...Object.keys(oldData || {}),
    ...Object.keys(newData || {}),
  ]);

  return Array.from(fields)
    .filter((field) => !IGNORED_FIELDS.has(field))
    .filter((field) => stringifyValue(oldData?.[field]) !== stringifyValue(newData?.[field]))
    .map((field) => ({
      field_name: field,
      old_value: stringifyValue(oldData?.[field]),
      new_value: stringifyValue(newData?.[field]),
    }))
    .slice(0, 20);
}

function getActionLabel(actionType) {
  if (actionType === 'create') return 'Creó';
  if (actionType === 'update') return 'Actualizó';
  if (actionType === 'delete') return 'Eliminó';
  return 'Registró';
}

function buildActionDetail(entityName, actionType, changedFields) {
  if (actionType === 'create') return `Creación de ${entityName}`;
  if (actionType === 'delete') return `Eliminación de ${entityName}`;

  if (!changedFields.length) return `Actualización de ${entityName} sin diferencias detectadas`;

  const fieldsPreview = changedFields.slice(0, 5).map((field) => field.field_name).join(', ');
  return `Campos modificados: ${fieldsPreview}`;
}

function getActorRoleLabel(actor) {
  if (actor?.role === 'user') return 'cliente';
  if (actor?.role === 'admin') return 'admin';
  return String(actor?.role || 'system');
}

function getModuleLabel(entityName) {
  return AREA_ROLE_LABELS[String(entityName || '').toLowerCase()] || entityName;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const event = payload?.event || {};
    const entityName = String(event.entity_name || '');
    const actionType = String(event.type || '');

    if (!entityName || !['create', 'update', 'delete'].includes(actionType)) {
      return Response.json({ ok: true, ignored: true });
    }

    const actor = await base44.auth.me().catch(() => null);
    const newData = payload?.data || null;
    const oldData = payload?.old_data || null;
    const sourceData = actionType === 'delete' ? oldData : newData;
    const changedFields = getChangedFields(oldData, newData, actionType);
    const entityLabel = getEntityLabel(entityName, sourceData || oldData || newData);
    const summary = `${getActionLabel(actionType)} ${entityName} ${entityLabel}`;
    const actionDetail = buildActionDetail(entityName, actionType, changedFields);

    const log = await base44.asServiceRole.entities.ActivityAuditLog.create({
      entity_name: entityName,
      entity_id: String(event.entity_id || sourceData?.id || oldData?.id || ''),
      entity_label: entityLabel,
      action_type: actionType,
      action_detail: actionDetail,
      actor_email: actor?.email || sourceData?.created_by || 'system',
      actor_name: actor?.full_name || 'Sistema',
      actor_role: getActorRoleLabel(actor),
      module_name: getModuleLabel(entityName),
      session_id: String(payload?.session_id || ''),
      page_path: String(payload?.page_path || ''),
      duration_ms: Number(payload?.duration_ms || 0),
      client_side_timestamp: String(payload?.client_side_timestamp || new Date().toISOString()),
      summary,
      changed_fields: changedFields,
    });

    return Response.json({ ok: true, log });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});