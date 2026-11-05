// Avisos de cobro programados según el calendario de los Términos y Condiciones
// (sección VII). Corre a diario desde el workflow "Notificaciones de
// Almacenamiento Automáticas".
//
// - Cada factura impaga recibe el aviso de la etapa en que está (día 5, 7, 8, 14,
//   20, 22, 25 y 26 desde la emisión). Cada etapa se envía una sola vez
//   (BillingNotice), y si una etapa se pasó por más de 2 días no se envía tarde.
// - Los avisos se detienen cuando la factura se paga, se cancela, tiene un pago en
//   revisión o queda sin saldo.
// - No modifica las facturas.
//
// payload opcional: { dry_run: true } devuelve qué se enviaría hoy sin enviar.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { sendBrevoEmail } from '../../shared/brevoEmail.ts';
import {
  STAGES,
  termsDay,
  storageAccrued,
  invoiceBalance,
  shouldStopNotices,
  buildBillingEmail,
} from '../../shared/billingNotices.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const CATCH_UP_DAYS = 2;

function dueStage(day: number) {
  const reached = STAGES.filter((s) => s.day <= day);
  const stage = reached[reached.length - 1];
  if (!stage || day - stage.day > CATCH_UP_DAYS) return null;
  return stage;
}

async function clientNames(base44: any, emails: string[]) {
  const map: Record<string, string> = {};
  for (let i = 0; i < emails.length; i += 50) {
    const users = await base44.asServiceRole.entities.User.filter({ email: { $in: emails.slice(i, i + 50) } }).catch(() => []);
    for (const u of users || []) {
      map[u.email] = u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'cliente';
    }
  }
  return map;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAutomation = req.headers.get('x-base44-automation') === 'true';
    if (!isAutomation) {
      const user = await base44.auth.me().catch(() => null);
      if (!user || user.role !== 'admin') {
        return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
      }
    }
    const payload: any = await req.json().catch(() => ({}));
    const dryRun = payload?.dry_run === true;

    const appCfg = (await base44.asServiceRole.entities.AppConfig
      .filter({ config_key: 'main' }, { limit: 1 })
      .catch(() => ({ items: [] })))?.items?.[0] || null;
    if (!dryRun && (appCfg?.emails_enabled === false || appCfg?.demo_mode)) {
      return Response.json({ success: true, skipped: 'emails_desactivados', processed: 0 });
    }

    const since = new Date(Date.now() - 30 * DAY_MS).toISOString();
    const page = await base44.asServiceRole.entities.Invoice.filter(
      { invoice_date: { $gte: since }, status: { $nin: ['pagada', 'cancelada', 'revision'] } },
      { sort: 'invoice_date', limit: 500 }
    );

    const now = new Date();
    const candidates: any[] = [];
    for (const inv of page?.items || []) {
      if (!inv.client_email || !inv.invoice_date || shouldStopNotices(inv)) continue;
      const day = termsDay(inv.invoice_date, now);
      const stage = dueStage(day);
      if (stage) candidates.push({ inv, day, stage });
    }
    if (!candidates.length) return Response.json({ success: true, processed: 0, details: [] });

    const ids = candidates.map((c) => c.inv.id);
    const sentPage = await base44.asServiceRole.entities.BillingNotice
      .filter({ invoice_id: { $in: ids } }, { limit: 5000 });
    const already = new Set((sentPage?.items || [])
      .filter((n: any) => n.status !== 'fallido')
      .map((n: any) => `${n.invoice_id}|${n.stage}`));
    const pending = candidates.filter((c) => !already.has(`${c.inv.id}|${c.stage.key}`));

    const names = await clientNames(base44, [...new Set(pending.map((c) => c.inv.client_email))]);
    const results: any[] = [];

    for (const { inv, day, stage } of pending) {
      const ctx = {
        clientName: names[inv.client_email] || 'cliente',
        invoiceNumber: inv.invoice_number || inv.id,
        invoiceDate: inv.invoice_date,
        day,
        balance: invoiceBalance(inv),
      };
      const email = buildBillingEmail(stage.key, ctx);
      const accrued = storageAccrued(day);

      if (dryRun) {
        results.push({ invoice: ctx.invoiceNumber, client: inv.client_email, day, stage: stage.key, subject: email.subject, balance: ctx.balance, storage_accrued: accrued });
        continue;
      }

      // Se registra antes de enviar para que dos corridas simultáneas no dupliquen el aviso.
      const notice = await base44.asServiceRole.entities.BillingNotice.create({
        invoice_id: inv.id,
        invoice_number: ctx.invoiceNumber,
        client_email: inv.client_email,
        stage: stage.key,
        day_number: day,
        balance: ctx.balance,
        storage_accrued: accrued,
        status: 'enviando',
      });

      const res = await sendBrevoEmail(base44, {
        to: inv.client_email,
        subject: email.subject,
        body: email.html,
        from_name: 'TLEC CARGO',
        source: 'avisos_cobro',
      } as any);

      await base44.asServiceRole.entities.BillingNotice.update(notice.id, {
        status: res?.sent ? 'enviado' : 'fallido',
        via: res?.via || null,
        error: res?.sent ? null : (res?.error || 'No enviado'),
        sent_date: new Date().toISOString(),
      });

      await base44.asServiceRole.entities.Notification.create({
        user_email: inv.client_email,
        title: email.inAppTitle,
        message: email.inAppMessage,
        type: 'payment',
        priority: email.priority,
        icon: 'alert',
        reference_id: inv.id,
        entity_type: 'Invoice',
        read: false,
      }).catch(() => null);

      results.push({ invoice: ctx.invoiceNumber, client: inv.client_email, day, stage: stage.key, sent: !!res?.sent, via: res?.via, error: res?.error });
    }

    return Response.json({ success: true, dry_run: dryRun, processed: results.length, details: results });
  } catch (error: any) {
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
});