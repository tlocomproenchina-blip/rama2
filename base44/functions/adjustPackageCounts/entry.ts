import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Ajusta incrementalmente los conteos globales de paquetes tras un CUD.
// Llamado por el workflow "Conteos de Paquetes - Incremental".
// No hace escaneo: usa $inc atómico sobre el registro único PackageCounts.
Deno.serve(async (req) => {
  // Medición: cuánto tarda cada parte (lectura del cuerpo, consulta y escritura del conteo)
  const t0 = Date.now();
  const timings: Record<string, number> = {};
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    timings.parse_ms = Date.now() - t0;
    const {
      event_type,
      status,            // status actual (.trigger.data.status)
      old_status,         // status previo (.trigger.old_data.status) — solo update
      received_date,      // received_date actual (.trigger.data.received_date)
      old_received_date,  // received_date previo (.trigger.old_data.received_date) — solo update
    } = body || {};

    // Mapeo de status a campo de conteo
    const STATUS_FIELDS = {
      recibido: 'recibido',
      consolidado: 'consolidado',
      en_transito: 'en_transito',
      entregado: 'entregado',
    };

    const isPreAlertaNoRecibido = (st, rd) => st === 'pre_alerta' && !rd;

    // Normalizar según event_type
    let newStatus, oldStatusVal, newRd, oldRdVal;
    if (event_type === 'create') {
      newStatus = status; newRd = received_date;
    } else if (event_type === 'delete') {
      oldStatusVal = status; oldRdVal = received_date;
    } else if (event_type === 'update') {
      oldStatusVal = old_status; newStatus = status;
      oldRdVal = old_received_date; newRd = received_date;
    } else {
      return Response.json({ success: true, skipped: true });
    }

    const updates = {};
    const apply = (field, delta) => {
      if (!field || delta === 0) return;
      updates[field] = (updates[field] || 0) + delta;
    };

    if (event_type === 'create') {
      apply('total', 1);
      if (STATUS_FIELDS[newStatus]) apply(STATUS_FIELDS[newStatus], 1);
      if (isPreAlertaNoRecibido(newStatus, newRd)) apply('pre_alerta_no_recibido', 1);
    } else if (event_type === 'delete') {
      apply('total', -1);
      if (STATUS_FIELDS[oldStatusVal]) apply(STATUS_FIELDS[oldStatusVal], -1);
      if (isPreAlertaNoRecibido(oldStatusVal, oldRdVal)) apply('pre_alerta_no_recibido', -1);
    } else if (event_type === 'update') {
      if (oldStatusVal !== newStatus) {
        if (STATUS_FIELDS[oldStatusVal]) apply(STATUS_FIELDS[oldStatusVal], -1);
        if (STATUS_FIELDS[newStatus]) apply(STATUS_FIELDS[newStatus], 1);
      }
      const was = isPreAlertaNoRecibido(oldStatusVal, oldRdVal);
      const is = isPreAlertaNoRecibido(newStatus, newRd);
      if (was && !is) apply('pre_alerta_no_recibido', -1);
      else if (!was && is) apply('pre_alerta_no_recibido', 1);
    }

    if (Object.keys(updates).length === 0) {
      console.log(`[adjustPackageCounts] skipped event=${event_type} total_ms=${Date.now() - t0}`);
      return Response.json({ success: true, skipped: true, timings: { total_ms: Date.now() - t0 } });
    }

    // Asegurar que el registro existe (lo crea el backfill, pero por seguridad)
    const tRead = Date.now();
    const existing = await base44.asServiceRole.entities.PackageCounts.filter({ config_key: 'main' }, '-updated_date', 1);
    timings.read_ms = Date.now() - tRead;
    const tWrite = Date.now();
    if (!existing || existing.length === 0) {
      const init = {
        config_key: 'main',
        total: 0, pre_alerta_no_recibido: 0, recibido: 0, consolidado: 0,
        en_transito: 0, entregado: 0, stale: 0,
        last_updated_at: new Date().toISOString(),
      };
      for (const [k, v] of Object.entries(updates)) init[k] = v;
      await base44.asServiceRole.entities.PackageCounts.create(init);
    } else {
      const incFields = {};
      for (const [k, v] of Object.entries(updates)) incFields[k] = v;
      await base44.asServiceRole.entities.PackageCounts.updateMany(
        { config_key: 'main' },
        { $inc: incFields, $set: { last_updated_at: new Date().toISOString() } }
      );
    }

    timings.write_ms = Date.now() - tWrite;
    timings.total_ms = Date.now() - t0;
    console.log(`[adjustPackageCounts] event=${event_type} parse_ms=${timings.parse_ms} read_ms=${timings.read_ms} write_ms=${timings.write_ms} total_ms=${timings.total_ms}`);

    return Response.json({ success: true, applied: updates, timings });
  } catch (error) {
    console.error(`adjustPackageCounts error after ${Date.now() - t0}ms:`, error);
    return Response.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
});