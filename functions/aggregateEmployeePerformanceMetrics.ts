import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const TIMEZONE = 'America/Caracas';
const BATCH_SIZE = 200;
const MAX_RECORDS = 10000;

function getLocalDateString(value, timeZone = TIMEZONE) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function toIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed);
}

function incrementCounter(target, key, amount = 1) {
  if (!key) return;
  target[key] = (target[key] || 0) + amount;
}

function getTopKey(counter) {
  return Object.entries(counter || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

async function fetchLogsForDate(entityApi, dateFieldCandidates, metricDate) {
  const records = [];

  for (let skip = 0; skip < MAX_RECORDS; skip += BATCH_SIZE) {
    const rows = await entityApi.list('-created_date', BATCH_SIZE, skip);
    if (!rows?.length) break;

    for (const row of rows) {
      const sourceDate = dateFieldCandidates.map((field) => row?.[field]).find(Boolean) || row?.created_date;
      const localDate = getLocalDateString(sourceDate);
      if (localDate === metricDate) {
        records.push(row);
      }
    }

    const lastRow = rows[rows.length - 1];
    const lastSourceDate = dateFieldCandidates.map((field) => lastRow?.[field]).find(Boolean) || lastRow?.created_date;
    const lastLocalDate = getLocalDateString(lastSourceDate);

    if (lastLocalDate < metricDate || rows.length < BATCH_SIZE) {
      break;
    }
  }

  return records;
}

function createBaseMetric(log) {
  return {
    employee_email: String(log?.actor_email || ''),
    employee_name: String(log?.actor_name || log?.actor_email || 'Sin nombre'),
    employee_role: String(log?.actor_role || log?.area_name || log?.area_code || ''),
    first_activity_at: null,
    last_activity_at: null,
    total_session_time_ms: 0,
    total_active_time_ms: 0,
    total_idle_time_ms: 0,
    total_events: 0,
    page_views: 0,
    page_exits: 0,
    heartbeats: 0,
    manual_actions: 0,
    entity_changes: 0,
    entity_creates: 0,
    entity_updates: 0,
    entity_deletes: 0,
    action_counts: {},
    module_counts: {},
    page_counts: {},
    entity_counts: {},
    session_ids: new Set(),
    page_set: new Set(),
    module_set: new Set(),
  };
}

function applyActivityLog(metric, log) {
  const timestamp = toIso(log?.client_side_timestamp || log?.created_date);
  if (timestamp && (!metric.first_activity_at || timestamp < metric.first_activity_at)) metric.first_activity_at = timestamp;
  if (timestamp && (!metric.last_activity_at || timestamp > metric.last_activity_at)) metric.last_activity_at = timestamp;

  const durationMs = toNumber(log?.duration_ms);
  const activeTimeMs = toNumber(log?.active_time_ms);
  const idleTimeMs = toNumber(log?.idle_time_ms);

  metric.total_events += 1;
  metric.total_session_time_ms += durationMs || activeTimeMs + idleTimeMs;
  metric.total_active_time_ms += activeTimeMs;
  metric.total_idle_time_ms += idleTimeMs;

  const activityKind = String(log?.activity_kind || 'manual_action');
  if (activityKind === 'page_view') metric.page_views += 1;
  if (activityKind === 'page_exit') metric.page_exits += 1;
  if (activityKind === 'heartbeat') metric.heartbeats += 1;
  if (activityKind === 'manual_action') metric.manual_actions += 1;

  incrementCounter(metric.action_counts, String(log?.action_type || activityKind));
  incrementCounter(metric.module_counts, String(log?.module_name || 'General'));
  incrementCounter(metric.page_counts, String(log?.page_name || log?.page_path || 'Sin página'));

  if (log?.session_id) metric.session_ids.add(String(log.session_id));
  if (log?.page_name || log?.page_path) metric.page_set.add(String(log.page_name || log.page_path));
  if (log?.module_name) metric.module_set.add(String(log.module_name));

  if (!metric.employee_name && log?.actor_name) metric.employee_name = String(log.actor_name);
  if (!metric.employee_role && (log?.actor_role || log?.area_name)) metric.employee_role = String(log.actor_role || log.area_name);
}

function applyEntityLog(metric, log) {
  const timestamp = toIso(log?.client_side_timestamp || log?.created_date);
  if (timestamp && (!metric.first_activity_at || timestamp < metric.first_activity_at)) metric.first_activity_at = timestamp;
  if (timestamp && (!metric.last_activity_at || timestamp > metric.last_activity_at)) metric.last_activity_at = timestamp;

  metric.entity_changes += 1;
  incrementCounter(metric.entity_counts, String(log?.entity_name || 'General'));

  const actionType = String(log?.action_type || 'update');
  if (actionType === 'create') metric.entity_creates += 1;
  if (actionType === 'update') metric.entity_updates += 1;
  if (actionType === 'delete') metric.entity_deletes += 1;

  incrementCounter(metric.action_counts, `entity_${actionType}`);
  incrementCounter(metric.module_counts, String(log?.module_name || log?.entity_name || 'General'));
  incrementCounter(metric.page_counts, String(log?.page_path || 'Sin página'));

  if (log?.session_id) metric.session_ids.add(String(log.session_id));
  if (log?.page_path) metric.page_set.add(String(log.page_path));
  if (log?.module_name || log?.entity_name) metric.module_set.add(String(log.module_name || log.entity_name));

  if (!metric.employee_name && log?.actor_name) metric.employee_name = String(log.actor_name);
  if (!metric.employee_role && log?.actor_role) metric.employee_role = String(log.actor_role);
}

async function upsertMetric(base44, metricDate, metric) {
  const totalMeasured = metric.total_active_time_ms + metric.total_idle_time_ms;
  const activeEfficiency = totalMeasured > 0 ? Number(((metric.total_active_time_ms / totalMeasured) * 100).toFixed(2)) : 0;
  const workSpanMs = metric.first_activity_at && metric.last_activity_at
    ? Math.max(0, new Date(metric.last_activity_at).getTime() - new Date(metric.first_activity_at).getTime())
    : 0;

  const payload = {
    metric_date: metricDate,
    employee_email: metric.employee_email,
    employee_name: metric.employee_name,
    employee_role: metric.employee_role,
    first_activity_at: metric.first_activity_at,
    last_activity_at: metric.last_activity_at,
    work_span_ms: workSpanMs,
    total_session_time_ms: metric.total_session_time_ms,
    total_active_time_ms: metric.total_active_time_ms,
    total_idle_time_ms: metric.total_idle_time_ms,
    active_efficiency_pct: activeEfficiency,
    total_events: metric.total_events,
    page_views: metric.page_views,
    page_exits: metric.page_exits,
    heartbeats: metric.heartbeats,
    manual_actions: metric.manual_actions,
    entity_changes: metric.entity_changes,
    entity_creates: metric.entity_creates,
    entity_updates: metric.entity_updates,
    entity_deletes: metric.entity_deletes,
    unique_sessions: metric.session_ids.size,
    unique_pages: metric.page_set.size,
    unique_modules: metric.module_set.size,
    most_active_page: getTopKey(metric.page_counts),
    most_active_module: getTopKey(metric.module_counts),
    action_counts: metric.action_counts,
    module_counts: metric.module_counts,
    page_counts: metric.page_counts,
    entity_counts: metric.entity_counts,
  };

  const existing = await base44.asServiceRole.entities.EmployeePerformanceMetric.filter({
    metric_date: metricDate,
    employee_email: metric.employee_email,
  }, '-updated_date', 1);

  if (existing?.[0]?.id) {
    return await base44.asServiceRole.entities.EmployeePerformanceMetric.update(existing[0].id, payload);
  }

  return await base44.asServiceRole.entities.EmployeePerformanceMetric.create(payload);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const metricDate = String(payload?.metric_date || getLocalDateString(new Date()));

    const [employeeLogs, entityLogs] = await Promise.all([
      fetchLogsForDate(base44.asServiceRole.entities.EmployeeAuditLog, ['client_side_timestamp', 'created_date'], metricDate),
      fetchLogsForDate(base44.asServiceRole.entities.ActivityAuditLog, ['client_side_timestamp', 'created_date'], metricDate),
    ]);

    const metricsByEmployee = new Map();

    for (const log of employeeLogs) {
      const email = String(log?.actor_email || '');
      if (!email) continue;
      const metric = metricsByEmployee.get(email) || createBaseMetric(log);
      applyActivityLog(metric, log);
      metricsByEmployee.set(email, metric);
    }

    for (const log of entityLogs) {
      const email = String(log?.actor_email || '');
      if (!email || email === 'system') continue;
      const metric = metricsByEmployee.get(email) || createBaseMetric(log);
      applyEntityLog(metric, log);
      metricsByEmployee.set(email, metric);
    }

    const saved = [];
    for (const metric of metricsByEmployee.values()) {
      saved.push(await upsertMetric(base44, metricDate, metric));
    }

    return Response.json({
      ok: true,
      metric_date: metricDate,
      employee_logs_processed: employeeLogs.length,
      entity_logs_processed: entityLogs.length,
      metrics_saved: saved.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});