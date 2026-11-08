import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Conteos globales de paquetes calculados en vivo por el servidor (una agrupación por
// estado y dos conteos). Siempre coinciden con los registros: no dependen de un
// contador guardado que se ajusta evento por evento.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const P = base44.entities.Package;
    const staleThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [agg, preNoRecibido, stale] = await Promise.all([
      P.aggregate({ groupBy: 'status' }),
      P.count({ status: 'pre_alerta', received_date: { $in: [null] } }),
      P.count({ status: 'pre_alerta', created_date: { $lte: staleThreshold } }),
    ]);

    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const row of agg?.rows || []) {
      const key = row.status || 'sin_estado';
      byStatus[key] = (byStatus[key] || 0) + (row.count || 0);
      total += row.count || 0;
    }

    return Response.json({
      counts: {
        total,
        pre_alerta_no_recibido: preNoRecibido || 0,
        recibido: byStatus.recibido || 0,
        consolidado: byStatus.consolidado || 0,
        en_transito: byStatus.en_transito || 0,
        entregado: byStatus.entregado || 0,
        stale: stale || 0,
        by_status: byStatus,
      },
      computed_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('getPackageCounts error:', error);
    return Response.json({ error: error?.message || 'Internal error' }, { status: 500 });
  }
}