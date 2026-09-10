import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Recalcula todos los conteos de paquetes desde cero (escaneo con tope 50k)
// y hace upsert del registro único PackageCounts.
// Usado para: backfill inicial y recuento nocturno de corrección de drift.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const staleThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const acc = {
      total: 0, pre_alerta_no_recibido: 0, recibido: 0,
      consolidado: 0, en_transito: 0, entregado: 0, stale: 0,
    };
    const B = 1000;
    let s = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.Package.list('-created_date', B, s);
      if (!batch || batch.length === 0) break;
      for (const p of batch) {
        acc.total++;
        const st = p?.status;
        if (st === 'recibido') acc.recibido++;
        else if (st === 'consolidado') acc.consolidado++;
        else if (st === 'en_transito') acc.en_transito++;
        else if (st === 'entregado') acc.entregado++;
        else if (st === 'pre_alerta') {
          if (!p.received_date) acc.pre_alerta_no_recibido++;
          if (p.created_date && p.created_date <= staleThreshold) acc.stale++;
        }
      }
      if (batch.length < B) break;
      s += B;
      if (s > 50000) break; // safety cap
    }

    const now = new Date().toISOString();

    // Upsert: borrar registros main existentes y crear uno fresco
    await base44.asServiceRole.entities.PackageCounts.deleteMany({ config_key: 'main' }).catch(() => {});
    await base44.asServiceRole.entities.PackageCounts.create({
      config_key: 'main',
      ...acc,
      last_updated_at: now,
      last_recount_at: now,
    });

    return Response.json({ success: true, counts: acc });
  } catch (error) {
    console.error('recountPackages error:', error);
    return Response.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
});