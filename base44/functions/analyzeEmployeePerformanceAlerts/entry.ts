import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const TIMEZONE = 'America/Caracas';

function getLocalDateString(value, timeZone = TIMEZONE) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function toNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function hoursFromMs(value) {
  return Number((toNumber(value) / 3600000).toFixed(1));
}

function buildAlerts(metric, history) {
  const alerts = [];
  const activeHours = hoursFromMs(metric.total_active_time_ms);
  const idleHours = hoursFromMs(metric.total_idle_time_ms);
  const efficiency = Number(metric.active_efficiency_pct || 0);
  const workSpanHours = hoursFromMs(metric.work_span_ms);
  const previous = (history || []).filter((item) => item.metric_date !== metric.metric_date).slice(0, 7);
  const avgPreviousActiveHours = previous.length
    ? previous.reduce((sum, item) => sum + hoursFromMs(item.total_active_time_ms), 0) / previous.length
    : 0;
  const avgPreviousEfficiency = previous.length
    ? previous.reduce((sum, item) => sum + Number(item.active_efficiency_pct || 0), 0) / previous.length
    : 0;

  if (efficiency < 45 && activeHours >= 1) {
    alerts.push({
      severity: efficiency < 30 ? 'high' : 'medium',
      alert_type: 'low_efficiency',
      title: 'Baja eficiencia activa detectada',
      message: `${metric.employee_name || metric.employee_email} cerró el día con ${efficiency.toFixed(0)}% de eficiencia activa.`,
    });
  }

  if (activeHours < 2 && toNumber(metric.total_events) >= 3) {
    alerts.push({
      severity: activeHours < 1 ? 'high' : 'medium',
      alert_type: 'low_activity',
      title: 'Poca actividad productiva',
      message: `${metric.employee_name || metric.employee_email} registró solo ${activeHours.toFixed(1)} horas activas.`,
    });
  }

  if (idleHours >= 2 && idleHours > activeHours) {
    alerts.push({
      severity: idleHours >= 4 ? 'high' : 'medium',
      alert_type: 'excess_idle_time',
      title: 'Exceso de tiempo inactivo',
      message: `${metric.employee_name || metric.employee_email} acumuló ${idleHours.toFixed(1)} horas inactivas, por encima de su tiempo activo.`,
    });
  }

  if (workSpanHours >= 10 && efficiency < 55) {
    alerts.push({
      severity: 'medium',
      alert_type: 'extended_low_quality_shift',
      title: 'Jornada extensa con baja calidad',
      message: `${metric.employee_name || metric.employee_email} tuvo una jornada de ${workSpanHours.toFixed(1)} horas con eficiencia de ${efficiency.toFixed(0)}%.`,
    });
  }

  if (previous.length >= 3 && avgPreviousActiveHours >= 2 && activeHours < avgPreviousActiveHours * 0.65) {
    alerts.push({
      severity: 'medium',
      alert_type: 'negative_active_trend',
      title: 'Caída frente a su promedio reciente',
      message: `${metric.employee_name || metric.employee_email} bajó su tiempo activo a ${activeHours.toFixed(1)}h versus un promedio reciente de ${avgPreviousActiveHours.toFixed(1)}h.`,
    });
  }

  if (previous.length >= 3 && avgPreviousEfficiency >= 55 && efficiency < avgPreviousEfficiency - 20) {
    alerts.push({
      severity: 'medium',
      alert_type: 'negative_efficiency_trend',
      title: 'Caída de eficiencia frente a días previos',
      message: `${metric.employee_name || metric.employee_email} cayó a ${efficiency.toFixed(0)}% de eficiencia frente a un promedio reciente de ${avgPreviousEfficiency.toFixed(0)}%.`,
    });
  }

  return alerts.map((alert) => ({
    ...alert,
    evidence: {
      active_hours: activeHours,
      idle_hours: idleHours,
      efficiency_pct: efficiency,
      work_span_hours: workSpanHours,
      total_events: toNumber(metric.total_events),
      avg_previous_active_hours: Number(avgPreviousActiveHours.toFixed(1)),
      avg_previous_efficiency_pct: Number(avgPreviousEfficiency.toFixed(0)),
    },
  }));
}

async function getAdminUsers(base44) {
  const rows = await base44.asServiceRole.entities.User.filter({ role: 'admin' }, '-created_date', 200);
  return rows || [];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const metricDate = String(payload?.metric_date || getLocalDateString(new Date()));

    const [metrics, admins, existingAlerts] = await Promise.all([
      base44.asServiceRole.entities.EmployeePerformanceMetric.filter({ metric_date: metricDate }, '-total_active_time_ms', 300),
      getAdminUsers(base44),
      base44.asServiceRole.entities.EmployeePerformanceAlert.filter({ metric_date: metricDate }, '-updated_date', 300),
    ]);
    const savedAlerts = [];

    for (const metric of metrics || []) {
      const history = await base44.asServiceRole.entities.EmployeePerformanceMetric.filter({ employee_email: metric.employee_email }, '-metric_date', 10);
      const alerts = buildAlerts(metric, history || []);

      for (const alert of alerts) {
        const existing = await base44.asServiceRole.entities.EmployeePerformanceAlert.filter({
          alert_date: metricDate,
          employee_email: metric.employee_email,
          alert_type: alert.alert_type,
        }, '-updated_date', 1);

        const payloadToSave = {
          alert_date: metricDate,
          metric_date: metricDate,
          employee_email: metric.employee_email,
          employee_name: metric.employee_name,
          employee_role: metric.employee_role,
          severity: alert.severity,
          alert_type: alert.alert_type,
          title: alert.title,
          message: alert.message,
          status: 'new',
          evidence: alert.evidence,
          notified_admins: true,
        };

        if (existing?.[0]?.id) {
          const updated = await base44.asServiceRole.entities.EmployeePerformanceAlert.update(existing[0].id, payloadToSave);
          savedAlerts.push(updated);
        } else {
          const created = await base44.asServiceRole.entities.EmployeePerformanceAlert.create(payloadToSave);
          savedAlerts.push(created);
        }
      }
    }

    const validAlertKeys = new Set(savedAlerts.map((item) => `${item.employee_email}::${item.alert_type}`));
    for (const existingAlert of existingAlerts || []) {
      const alertKey = `${existingAlert.employee_email}::${existingAlert.alert_type}`;
      if (!validAlertKeys.has(alertKey)) {
        await base44.asServiceRole.entities.EmployeePerformanceAlert.delete(existingAlert.id);
      }
    }

    const highAlerts = savedAlerts.filter((item) => item.severity === 'high');
    const mediumAlerts = savedAlerts.filter((item) => item.severity === 'medium');

    if (savedAlerts.length > 0) {
      await Promise.all(
        admins.map((admin) => base44.asServiceRole.entities.Notification.create({
          user_email: admin.email,
          title: 'Alertas de rendimiento detectadas',
          message: `Se detectaron ${savedAlerts.length} alertas de rendimiento para ${metricDate}. Altas: ${highAlerts.length}, medias: ${mediumAlerts.length}.`,
          type: 'system',
          priority: highAlerts.length > 0 ? 'high' : 'medium',
          reference_id: metricDate,
          entity_type: 'System',
          icon: highAlerts.length > 0 ? 'alert' : 'info',
          read: false,
        }))
      );
    }

    return Response.json({
      ok: true,
      metric_date: metricDate,
      alerts_created_or_updated: savedAlerts.length,
      high_alerts: highAlerts.length,
      medium_alerts: mediumAlerts.length,
      admins_notified: savedAlerts.length > 0 ? admins.length : 0,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});