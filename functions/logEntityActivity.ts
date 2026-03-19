import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const IGNORED_FIELDS = new Set(['id', 'created_date', 'updated_date', 'created_by']);

function stringifyValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function getEntityLabel(entityName, data) {
  if (entityName === 'Package') return data?.tracking_number || 'Paquete';
  if (entityName === 'Ruta') return data?.codigo_ruta || 'Ruta';
  return 'Registro';
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const event = payload?.event || {};
    const entityName = String(event.entity_name || '');
    const actionType = String(event.type || '');

    if (!['Package', 'Ruta'].includes(entityName) || !['create', 'update', 'delete'].includes(actionType)) {
      return Response.json({ ok: true, ignored: true });
    }

    const actor = await base44.auth.me().catch(() => null);
    const newData = payload?.data || null;
    const oldData = payload?.old_data || null;
    const sourceData = actionType === 'delete' ? oldData : newData;
    const changedFields = getChangedFields(oldData, newData, actionType);
    const entityLabel = getEntityLabel(entityName, sourceData || oldData || newData);
    const summary = `${actionType === 'create' ? 'Creó' : actionType === 'update' ? 'Actualizó' : 'Eliminó'} ${entityName === 'Package' ? 'paquete' : 'ruta'} ${entityLabel}`;

    const log = await base44.asServiceRole.entities.ActivityAuditLog.create({
      entity_name: entityName,
      entity_id: String(event.entity_id || sourceData?.id || oldData?.id || ''),
      entity_label: entityLabel,
      action_type: actionType,
      actor_email: actor?.email || sourceData?.created_by || 'system',
      actor_name: actor?.full_name || 'Sistema',
      summary,
      changed_fields: changedFields,
    });

    return Response.json({ ok: true, log });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});