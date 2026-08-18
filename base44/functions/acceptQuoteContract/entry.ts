import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendBrevoEmail } from '../../shared/brevoEmail.ts';

async function notifyAdminsOfContractAcceptance(base44: any, quote: any) {
  try {
    let emailsEnabled = true;
    try {
      const configs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
      if (configs?.[0]?.emails_enabled === false) emailsEnabled = false;
    } catch {}

    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    const adminEmails = (admins || []).map((a: any) => a.email).filter(Boolean);
    if (adminEmails.length === 0) return;

    const title = '✅ Cliente aceptó contrato de presupuesto';
    const message = `El cliente ${quote.client_first_name || ''} ${quote.client_last_name || ''} aceptó el contrato del presupuesto ${quote.quote_number || quote.token.slice(0, 8)}.`;

    await base44.asServiceRole.entities.Notification.bulkCreate(
      adminEmails.map((email: string) => ({
        user_email: email,
        title,
        message,
        type: 'system',
        icon: 'check',
        priority: 'high',
        reference_id: quote.id,
        entity_type: 'System',
        read: false,
      }))
    );

    if (emailsEnabled) {
      const appName = 'TLEC CARGO';
      const body = `<h2>✅ Contrato de presupuesto aceptado</h2>
<p>El cliente <strong>${quote.client_first_name || ''} ${quote.client_last_name || ''}</strong> ha aceptado el contrato del presupuesto <strong>${quote.quote_number || quote.token.slice(0, 8)}</strong>.</p>
<p>Total: $${(quote.total_usd || 0).toFixed(2)} USD</p>
<p style="margin-top:16px;color:#666;font-size:12px;">${appName}</p>`;
      await Promise.all(
        adminEmails.map((email: string) =>
          sendBrevoEmail(base44, { to: email, subject: title, body, from_name: appName, source: 'quote_contract_accepted' }).catch(() => {})
        )
      );
    }
  } catch (_) {}
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const token = String(body.token || '').trim();
    if (!token) return Response.json({ error: 'Token requerido' }, { status: 400 });

    const quotes = await base44.asServiceRole.entities.Quote.filter({ token }, '-created_date', 1);
    if (!quotes.length) return Response.json({ error: 'Presupuesto no encontrado' }, { status: 404 });

    const quote = quotes[0];
    if (quote.contract_accepted) {
      return Response.json({ error: 'El contrato ya fue aceptado' }, { status: 400 });
    }

    const updated = await base44.asServiceRole.entities.Quote.update(quote.id, {
      contract_accepted: true,
      contract_accepted_date: new Date().toISOString()
    });

    // Notificar a administradores que el cliente aceptó el contrato
    await notifyAdminsOfContractAcceptance(base44, updated);

    return Response.json({ quote: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}