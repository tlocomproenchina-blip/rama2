import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Devuelve los conteos globales de paquetes (registro único PackageCounts).
// Lectura rápida, sin escaneo. La mantiene el workflow incremental + recuento nocturno.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const rows = await base44.asServiceRole.entities.PackageCounts.filter({ config_key: 'main' }, '-updated_date', 1);
    const counts = rows?.[0] || null;

    return Response.json({
      counts: counts ? {
        total: counts.total || 0,
        pre_alerta_no_recibido: counts.pre_alerta_no_recibido || 0,
        recibido: counts.recibido || 0,
        consolidado: counts.consolidado || 0,
        en_transito: counts.en_transito || 0,
        entregado: counts.entregado || 0,
        stale: counts.stale || 0,
      } : null,
    });
  } catch (error) {
    console.error('getPackageCounts error:', error);
    return Response.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
});