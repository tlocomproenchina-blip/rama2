import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { findCompanyByCode } from '../../shared/companyContext.ts';

// Uso de una empresa socia: volumen de operaciones por el canal, errores,
// última conexión de su llave y cantidad de clientes sincronizados.

const MAX_LOGS = 1000;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const code = String(body?.company_code || '').trim();
    if (!code) return Response.json({ error: 'Falta company_code' }, { status: 400 });

    const company = await findCompanyByCode(base44, code);
    const days = Math.max(1, Math.min(180, Number(body?.days) || 30));
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const logs: any[] = [];
    for (let skip = 0; skip < MAX_LOGS; skip += 500) {
      const rows = await base44.asServiceRole.entities.CompanyUsageLog
        .filter({ company_code: code }, '-created_date', 500, skip)
        .catch(() => []);
      if (!rows?.length) break;
      logs.push(...rows);
      if (rows.length < 500) break;
    }

    const recent = logs.filter((log) => String(log.created_date || '') >= since);
    const byCapability: Record<string, number> = {};
    const byEntity: Record<string, number> = {};
    const byActor: Record<string, number> = {};
    let errors = 0;

    recent.forEach((log) => {
      const capability = String(log.capability || 'lectura');
      byCapability[capability] = (byCapability[capability] || 0) + 1;
      const target = log.function_name || log.entity_name;
      if (target) byEntity[String(target)] = (byEntity[String(target)] || 0) + 1;
      if (log.actor_email) byActor[String(log.actor_email)] = (byActor[String(log.actor_email)] || 0) + 1;
      if (log.success === false) errors += 1;
    });

    const topEntries = (source: Record<string, number>, limit: number) => Object.entries(source)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([label, count]) => ({ label, count }));

    let clientCount = 0;
    for (let skip = 0; skip < 3000; skip += 500) {
      const rows = await base44.asServiceRole.entities.CompanyClient
        .filter({ company_code: code }, 'client_email', 500, skip)
        .catch(() => []);
      if (!rows?.length) break;
      clientCount += rows.filter((row) => row.is_active !== false).length;
      if (rows.length < 500) break;
    }

    const lastActivity = recent[0]?.created_date || logs[0]?.created_date || null;

    return Response.json({
      ok: true,
      company: company ? {
        company_code: company.company_code,
        name: company.name || '',
        status: company.status || 'activa',
        service_key_prefix: company.service_key_prefix || '',
        service_key_last_used_date: company.service_key_last_used_date || null,
        app_built_date: company.app_built_date || null,
        activated_date: company.activated_date || null,
        disabled_date: company.disabled_date || null,
      } : null,
      summary: {
        days,
        operations: recent.length,
        errors,
        success_rate: recent.length ? Math.round(((recent.length - errors) / recent.length) * 100) : 0,
        last_activity: lastActivity,
        clients: clientCount,
        by_capability: byCapability,
        top_targets: topEntries(byEntity, 8),
        top_actors: topEntries(byActor, 5),
      },
      recent: recent.slice(0, 30).map((log) => ({
        id: log.id,
        created_date: log.created_date,
        capability: log.capability,
        action: log.action,
        entity_name: log.entity_name,
        function_name: log.function_name,
        record_count: log.record_count,
        actor_email: log.actor_email,
        success: log.success !== false,
        error_message: log.error_message,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}