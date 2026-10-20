import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { loadDueQueueItems, processQueueItems, queueFromName, QUEUE_BATCH_SIZE } from '../../shared/emailQueueProcess.ts';

// Procesa la cola EmailQueue en lotes. Se ejecuta por automatización programada.
// El envío, el registro en EmailLog y los reintentos viven en
// shared/emailQueueProcess.ts, que también usa el envío masivo inmediato.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Si viene invocada por un usuario (manual), debe ser admin. Las automatizaciones no traen usuario.
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Kill switch global
    const cfgs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });
    const cfg = cfgs?.[0] || {};
    if (cfg.emails_enabled === false) {
      return Response.json({ success: true, skipped: true, reason: 'emails_enabled=false' });
    }

    const due = await loadDueQueueItems(base44, { limit: QUEUE_BATCH_SIZE });
    const { sent, failed } = await processQueueItems(base44, due, queueFromName(cfg));

    return Response.json({ success: true, processed: due.length, sent, failed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});