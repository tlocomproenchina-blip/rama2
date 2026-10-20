import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { sendBrevoEmail } from '../../shared/brevoEmail.ts';
import { loadDueQueueItems, processQueueItems, queueFromName, QUEUE_BATCH_SIZE } from '../../shared/emailQueueProcess.ts';
import {
  buildTermsNoticeEmail,
  DEFAULT_TERMS_SUBJECT,
  DEFAULT_TERMS_MESSAGE,
  DEFAULT_TERMS_URL
} from '../../shared/termsNoticeEmail.ts';

// Aviso de actualización de términos de servicio.
// Un administrador revisa el asunto, el mensaje y el enlace, confirma el envío y
// el correo sale a todos los clientes activos una sola vez. El primer lote sale
// en esta misma corrida; el resto queda en EmailQueue y la automatización que ya
// procesa la cola lo termina de enviar sin que el admin tenga que hacer nada más.

const CAMPAIGN_NAME = 'Actualización de términos';
const QUEUE_SOURCE = 'terms_notice';
const PAGE = 200;
const MAX_PAGES = 60;
// Correos que alcanzan a salir en la corrida del admin (el resto va a la cola).
const IMMEDIATE_MAX = 100;
const IMMEDIATE_DEADLINE_MS = 45 * 1000;

function isEmail(value: any) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
}

// Clientes activos: sin administradores ni empleados por área, con la cuenta
// habilitada y un correo válido.
async function loadActiveClients(base44: any) {
  const found = new Map<string, any>();

  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await base44.asServiceRole.entities.User.list('-created_date', PAGE, page * PAGE);
    if (!batch || batch.length === 0) break;
    for (const user of batch) {
      if (!user) continue;
      if (user.role === 'admin' || user.custom_role) continue;
      if (user.is_active === false || user.disabled === true) continue;
      const email = String(user.email || '').trim().toLowerCase();
      if (!isEmail(email)) continue;
      if (found.has(email)) continue;
      found.set(email, {
        email,
        name: String(user.full_name || '').trim() || String(user.first_name || '').trim() || '',
      });
    }
    if (batch.length < PAGE) break;
  }

  return [...found.values()];
}

async function enqueueNotice(base44: any, recipients: any[], draft: any, batchId: string, fromName: string) {
  const rows = recipients.map((recipient) => ({
    recipient_email: recipient.email,
    subject: draft.subject,
    body: buildTermsNoticeEmail({
      recipientName: recipient.name,
      message: draft.message,
      termsUrl: draft.termsUrl
    }),
    from_name: fromName,
    status: 'pending',
    priority: 0,
    source: QUEUE_SOURCE,
    campaign_id: batchId,
    campaign_name: CAMPAIGN_NAME,
  }));

  for (let i = 0; i < rows.length; i += 500) {
    await base44.asServiceRole.entities.EmailQueue.bulkCreate(rows.slice(i, i + 500));
  }
}

async function countByStatus(base44: any, batchId: string) {
  const [sent, pending, failed] = await Promise.all([
    base44.asServiceRole.entities.EmailQueue.count({ campaign_id: batchId, status: 'sent' }),
    base44.asServiceRole.entities.EmailQueue.count({ campaign_id: batchId, status: 'pending' }),
    base44.asServiceRole.entities.EmailQueue.count({ campaign_id: batchId, status: 'failed' }),
  ]);
  const sentCount = Number(sent) || 0;
  const pendingCount = Number(pending) || 0;
  const failedCount = Number(failed) || 0;
  return {
    batch_id: batchId,
    sent: sentCount,
    pending: pendingCount,
    failed: failedCount,
    total: sentCount + pendingCount + failedCount
  };
}

// Última campaña registrada: permite que la tarjeta muestre el avance aunque el
// administrador recargue la página.
async function latestBatchId(base44: any) {
  const rows = await base44.asServiceRole.entities.EmailQueue.filter(
    { campaign_name: CAMPAIGN_NAME },
    '-created_date',
    1
  );
  return rows?.[0]?.campaign_id || null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me || me.role !== 'admin') {
      return Response.json({ error: 'Solo administradores pueden enviar este aviso.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'preview');

    const draft = {
      subject: String(body.subject ?? DEFAULT_TERMS_SUBJECT).trim().slice(0, 200) || DEFAULT_TERMS_SUBJECT,
      message: String(body.message ?? DEFAULT_TERMS_MESSAGE).trim().slice(0, 4000) || DEFAULT_TERMS_MESSAGE,
      termsUrl: String(body.terms_url ?? DEFAULT_TERMS_URL).trim() || DEFAULT_TERMS_URL,
    };

    const cfgs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });
    const cfg = cfgs?.[0] || {};
    const fromName = queueFromName(cfg);

    if (action === 'preview') {
      const recipients = await loadActiveClients(base44);
      const batchId = await latestBatchId(base44);
      return Response.json({
        ok: true,
        total: recipients.length,
        sample: recipients.slice(0, 20).map((r: any) => r.name || r.email),
        subject: draft.subject,
        message: draft.message,
        terms_url: draft.termsUrl,
        default_subject: DEFAULT_TERMS_SUBJECT,
        default_message: DEFAULT_TERMS_MESSAGE,
        default_terms_url: DEFAULT_TERMS_URL,
        emails_enabled: cfg.emails_enabled !== false,
        last: batchId ? await countByStatus(base44, batchId) : null,
      });
    }

    if (action === 'status') {
      const batchId = String(body.batch_id || '') || await latestBatchId(base44);
      if (!batchId) return Response.json({ ok: true, summary: null });
      return Response.json({ ok: true, summary: await countByStatus(base44, batchId) });
    }

    if (action === 'test') {
      if (cfg.emails_enabled === false) {
        return Response.json({ error: 'El envío de emails está desactivado en la configuración general.' }, { status: 400 });
      }
      const outcome = await sendBrevoEmail(base44, {
        to: me.email,
        subject: draft.subject,
        body: buildTermsNoticeEmail({
          recipientName: String(me.full_name || '').trim(),
          message: draft.message,
          termsUrl: draft.termsUrl
        }),
        from_name: fromName,
        source: 'campaign',
        campaign_name: CAMPAIGN_NAME,
      });
      if (!outcome.sent) {
        return Response.json({ error: outcome.error || 'No se pudo enviar la prueba.' }, { status: 400 });
      }
      return Response.json({ ok: true, sent_to: me.email });
    }

    if (action === 'send') {
      if (body.confirm !== true) {
        return Response.json({ error: 'Falta la confirmación del envío.' }, { status: 400 });
      }
      if (cfg.emails_enabled === false) {
        return Response.json({ error: 'El envío de emails está desactivado en la configuración general.' }, { status: 400 });
      }

      const recipients = await loadActiveClients(base44);
      if (recipients.length === 0) {
        return Response.json({ error: 'No hay clientes activos para enviar.' }, { status: 400 });
      }

      const batchId = `terms-${Date.now()}`;
      await enqueueNotice(base44, recipients, draft, batchId, fromName);

      // Primer lote inmediato: el resto lo termina la cola de correos.
      const deadline = Date.now() + IMMEDIATE_DEADLINE_MS;
      let processed = 0;
      while (processed < IMMEDIATE_MAX && Date.now() < deadline) {
        const items = await loadDueQueueItems(base44, {
          limit: Math.min(QUEUE_BATCH_SIZE, IMMEDIATE_MAX - processed),
          query: { campaign_id: batchId }
        });
        if (items.length === 0) break;
        const outcome = await processQueueItems(base44, items, fromName);
        processed += outcome.processed;
      }

      const summary = await countByStatus(base44, batchId);
      return Response.json({
        ok: true,
        batch_id: batchId,
        total: recipients.length,
        ...summary,
        immediate: processed,
        queued: summary.pending,
        message: `Aviso confirmado: ${summary.sent} correo(s) entregado(s) de ${recipients.length}${summary.pending ? `, ${summary.pending} en cola` : ''}${summary.failed ? `, ${summary.failed} fallido(s)` : ''}.`
      });
    }

    return Response.json({ error: `Acción no reconocida: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as any)?.message || 'No se pudo completar el envío del aviso.' }, { status: 500 });
  }
});