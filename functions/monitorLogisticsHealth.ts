import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

function getSeverity(summary) {
  if ((summary.resource_conflicts || 0) > 0 || (summary.duplicate_packages || 0) > 0) {
    return 'critical';
  }
  if ((summary.capacity_alerts || 0) > 0) {
    return 'warning';
  }
  return 'healthy';
}

function getSummaryText(summary) {
  return `Rutas activas: ${summary.active_routes || 0} · Cargas: ${summary.total_loads || 0} · Conflictos: ${summary.resource_conflicts || 0} · Duplicados: ${summary.duplicate_packages || 0} · Sobrecarga: ${summary.capacity_alerts || 0}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const response = await base44.asServiceRole.functions.invoke('runLogisticsHealthCheck', {});
    const data = response?.data || {};
    const summary = data.summary || {};
    const severity = getSeverity(summary);

    const report = await base44.asServiceRole.entities.LogisticsHealthReport.create({
      checked_at: data.checked_at || new Date().toISOString(),
      active_routes: Number(summary.active_routes || 0),
      total_loads: Number(summary.total_loads || 0),
      resource_conflicts: Number(summary.resource_conflicts || 0),
      duplicate_packages: Number(summary.duplicate_packages || 0),
      capacity_alerts: Number(summary.capacity_alerts || 0),
      severity,
      summary_text: getSummaryText(summary),
    });

    return Response.json({ ok: true, report, summary });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});