import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { ROLE_PRESETS, AREA_ROLE_CODES } from '../../shared/roleAreas.ts';
import { fetchAllFilter, BATCH } from '../../shared/paginatedFetch.ts';
import { splitWindows, parseDates, toMs } from '../../shared/caracasRange.ts';

// Métricas diarias de rendimiento, calculadas al vuelo a partir de los registros
// de actividad (EmployeeAuditLog y ActivityAuditLog). Solo cuentan los
// empleados: cuentas con acceso al panel y un área operativa asignada. Los
// administradores y los clientes quedan fuera.

const REVIEW_EFFICIENCY_PCT = 50;
const MIN_MEASURED_MS = 60000; // menos de 1 min medido no permite juzgar la eficiencia

function bump(map: Record<string, number>, key: string) {
  if (!key) return;
  map[key] = (map[key] || 0) + 1;
}

function topKey(map: Record<string, number>) {
  return Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

function emptyMetric(date: string, employee: any) {
  const code = String(employee.custom_role || '').toLowerCase();
  return {
    id: `${date}_${employee.email}`,
    metric_date: date,
    employee_email: employee.email,
    employee_name: employee.full_name || employee.email,
    employee_role: ROLE_PRESETS[code]?.role_name || employee.custom_role || 'Sin rol',
    first_activity_at: null as string | null,
    last_activity_at: null as string | null,
    work_span_ms: 0,
    total_session_time_ms: 0,
    total_active_time_ms: 0,
    total_idle_time_ms: 0,
    active_efficiency_pct: 0,
    total_events: 0,
    page_views: 0,
    page_exits: 0,
    heartbeats: 0,
    manual_actions: 0,
    entity_changes: 0,
    entity_creates: 0,
    entity_updates: 0,
    entity_deletes: 0,
    unique_sessions: 0,
    unique_pages: 0,
    unique_modules: 0,
    most_active_page: '',
    most_active_module: '',
    module_counts: {} as Record<string, number>,
    page_counts: {} as Record<string, number>,
    entity_counts: {} as Record<string, number>,
    _sessions: new Set<string>(),
    _first: Infinity,
    _last: -Infinity,
  };
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    // Un día (date) o un periodo (date + date_to), en hora de Caracas.
    const dates = parseDates(body);
    if ('error' in dates) return Response.json({ error: dates.error }, { status: 400 });
    const date = dates.dateFrom;
    const dateTo = dates.dateTo;

    const db = base44.asServiceRole.entities;

    // Empleados: role admin con un área operativa asignada.
    const admins = await fetchAllFilter(db.User, { role: 'admin' }, 'created_date');
    const employees = admins.filter((u: any) => {
      const code = String(u.custom_role || '').trim().toLowerCase();
      return u.email && AREA_ROLE_CODES.includes(code);
    });
    const byEmail: Record<string, any> = {};
    const metrics: Record<string, any> = {};
    for (const e of employees) {
      const key = String(e.email).toLowerCase();
      byEmail[key] = e;
      metrics[key] = emptyMetric(date, e);
    }
    const emails = employees.map((e: any) => e.email);

    // Periodos largos (histórico completo): se consulta por ventanas de 31 días, unas pocas a la vez.
    const windows = splitWindows(date, dateTo);
    const auditLogs: any[] = [];
    const entityLogs: any[] = [];
    const jobs: { chunk: string[]; range: any }[] = [];
    for (const w of windows) {
      for (let i = 0; i < emails.length; i += BATCH) jobs.push({ chunk: emails.slice(i, i + BATCH), range: { $gte: w.from, $lt: w.to } });
    }
    const PARALLEL = 4;
    for (let i = 0; i < jobs.length; i += PARALLEL) {
      const results = await Promise.all(jobs.slice(i, i + PARALLEL).map(async ({ chunk, range }) => ([
        await fetchAllFilter(db.EmployeeAuditLog, { actor_email: { $in: chunk }, created_date: range }, 'created_date'),
        await fetchAllFilter(db.ActivityAuditLog, { actor_email: { $in: chunk }, created_date: range }, 'created_date'),
      ])));
      for (const [a, b] of results) { auditLogs.push(...a); entityLogs.push(...b); }
    }

    const touch = (m: any, log: any) => {
      const t = toMs(log.client_side_timestamp) || toMs(log.created_date);
      const ts = Number.isFinite(t) ? t : toMs(log.created_date);
      if (Number.isFinite(ts)) {
        if (ts < m._first) m._first = ts;
        if (ts > m._last) m._last = ts;
      }
      m.total_events += 1;
      if (log.session_id) m._sessions.add(String(log.session_id));
      bump(m.module_counts, String(log.module_name || ''));
    };

    for (const log of auditLogs) {
      const m = metrics[String(log.actor_email || '').toLowerCase()];
      if (!m) continue;
      touch(m, log);
      const kind = String(log.activity_kind || '');
      if (kind === 'page_view') {
        m.page_views += 1;
        bump(m.page_counts, String(log.page_name || log.page_path || ''));
      } else if (kind === 'page_exit') {
        m.page_exits += 1;
      } else if (kind === 'heartbeat') {
        m.heartbeats += 1;
      } else if (kind === 'manual_action') {
        m.manual_actions += 1;
      }
      // El tiempo se mide en las salidas de página y los pulsos: ahí se reinician los contadores.
      if (kind === 'page_exit' || kind === 'heartbeat') {
        m.total_session_time_ms += Number(log.duration_ms || 0);
        m.total_active_time_ms += Number(log.active_time_ms || 0);
        m.total_idle_time_ms += Number(log.idle_time_ms || 0);
      }
    }

    for (const log of entityLogs) {
      const m = metrics[String(log.actor_email || '').toLowerCase()];
      if (!m) continue;
      touch(m, log);
      m.entity_changes += 1;
      if (log.action_type === 'create') m.entity_creates += 1;
      if (log.action_type === 'update') m.entity_updates += 1;
      if (log.action_type === 'delete') m.entity_deletes += 1;
      bump(m.entity_counts, String(log.entity_name || ''));
    }

    const rows = Object.values(metrics)
      .filter((m: any) => m.total_events > 0)
      .map((m: any) => {
        const measured = m.total_active_time_ms + m.total_idle_time_ms;
        const out = {
          ...m,
          first_activity_at: Number.isFinite(m._first) && m._first !== Infinity ? new Date(m._first).toISOString() : null,
          last_activity_at: Number.isFinite(m._last) && m._last !== -Infinity ? new Date(m._last).toISOString() : null,
          work_span_ms: m._last > m._first ? m._last - m._first : 0,
          measured_time_ms: measured,
          active_efficiency_pct: measured > 0 ? Math.round((m.total_active_time_ms / measured) * 100) : 0,
          needs_review: measured >= MIN_MEASURED_MS && (m.total_active_time_ms / measured) * 100 < REVIEW_EFFICIENCY_PCT,
          unique_sessions: m._sessions.size,
          unique_pages: Object.keys(m.page_counts).length,
          unique_modules: Object.keys(m.module_counts).length,
          most_active_page: topKey(m.page_counts),
          most_active_module: topKey(m.module_counts),
        };
        delete (out as any)._sessions;
        delete (out as any)._first;
        delete (out as any)._last;
        return out;
      })
      .sort((a: any, b: any) => b.total_active_time_ms - a.total_active_time_ms);

    const alertRows = await fetchAllFilter(db.EmployeePerformanceAlert, { metric_date: { $gte: date, $lte: dateTo } }, '-updated_date');
    const alerts = alertRows.filter((a: any) => byEmail[String(a.employee_email || '').toLowerCase()]);

    const cfg = await db.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);

    return Response.json({
      date,
      date_to: dateTo,
      employees: employees.map((e: any) => ({
        email: e.email,
        name: e.full_name || e.email,
        role: ROLE_PRESETS[String(e.custom_role || '').toLowerCase()]?.role_name || e.custom_role || '',
      })),
      metrics: rows,
      alerts,
      employees_total: employees.length,
      tracking_enabled: !!cfg?.[0]?.activity_tracking_enabled,
    });
  } catch (error) {
    return Response.json({ error: (error as any).message }, { status: 500 });
  }
}