// Procesamiento de la cola de correos, compartido por la automatización
// periódica (processEmailQueue) y por los envíos masivos confirmados a mano
// (sendTermsUpdate). Así el envío, el registro en EmailLog y los reintentos
// se comportan igual en los dos caminos.

import { sendBrevoEmail } from './brevoEmail.ts';

export const QUEUE_BATCH_SIZE = 25;
export const QUEUE_MAX_ATTEMPTS = 3;

export function queueFromName(cfg: any) {
  return cfg?.invoice_company_name || cfg?.app_name || 'TLEC CARGO';
}

// Pendientes cuyo scheduled_at ya pasó (o sin programar).
export async function loadDueQueueItems(base44: any, { limit, query }: { limit: number; query?: any }) {
  const now = new Date().toISOString();
  const pending = await base44.asServiceRole.entities.EmailQueue.filter(
    { status: 'pending', ...(query || {}) },
    '-priority',
    limit
  );
  return (pending || []).filter((item: any) => !item.scheduled_at || item.scheduled_at <= now);
}

// Envía un lote y deja el resultado de cada correo en EmailQueue y EmailLog.
export async function processQueueItems(base44: any, items: any[], fromNameDefault: string) {
  let sent = 0;
  let failed = 0;

  for (const item of items) {
    let ok = false;
    let errorMessage: string | null = null;
    try {
      const result = await sendBrevoEmail(base44, {
        to: item.recipient_email,
        subject: item.subject,
        body: item.body || '',
        from_name: item.from_name || fromNameDefault
      });
      if (!result.sent) {
        throw new Error(result.error || 'Envío fallido');
      }
      ok = true;
      sent++;
    } catch (err) {
      errorMessage = (err as any)?.message || String(err);
      failed++;
    }

    const attempts = (item.attempts || 0) + 1;
    await base44.asServiceRole.entities.EmailQueue.update(item.id, {
      status: ok ? 'sent' : (attempts >= QUEUE_MAX_ATTEMPTS ? 'failed' : 'pending'),
      attempts,
      error_message: errorMessage,
      sent_date: ok ? new Date().toISOString() : null
    });

    try {
      await base44.asServiceRole.entities.EmailLog.create({
        recipient_email: item.recipient_email,
        from_name: item.from_name || fromNameDefault,
        subject: item.subject,
        body_preview: String(item.body || '').slice(0, 200),
        campaign_id: item.campaign_id || null,
        campaign_name: item.campaign_name || null,
        source: item.source || 'queue',
        status: ok ? 'sent' : 'failed',
        bounce_reason: ok ? null : errorMessage,
        sent_date: new Date().toISOString()
      });
    } catch (_) {}
  }

  return { sent, failed, processed: items.length };
}