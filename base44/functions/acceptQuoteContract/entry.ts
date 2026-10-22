import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendBrevoEmail } from '../../shared/brevoEmail.ts';
import { INVOICE_IMMUTABLE_REASON } from '../../shared/invoiceLock.ts';

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

    // Crear factura automática por el monto del presupuesto (si no existe ya)
    let invoiceCreated = null;
    try {
      const totalUsd = Number(quote.total_usd || 0);
      if (totalUsd > 0 && quote.client_email) {
        // Verificar si ya existe una factura vinculada a este presupuesto
        const existing = await base44.asServiceRole.entities.Invoice.filter(
          { consolidation_id: quote.id },
          '-created_date',
          1
        );
        if (!existing.length) {
          const now = new Date();
          // Due date según configuración (default 7 días)
          let overdueDays = 7;
          try {
            const configs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
            if (configs?.[0]?.invoice_overdue_days) overdueDays = Number(configs[0].invoice_overdue_days) || 7;
          } catch {}
          const dueDate = new Date(now.getTime() + overdueDays * 24 * 60 * 60 * 1000);

          const items = (quote.items || []).map((item: any) => {
            const qty = Number(item.quantity || 1) || 1;
            const lineTotal = Number(item.total_usd || 0);
            const unitPrice = qty > 0 ? lineTotal / qty : 0;
            const descParts = [];
            if (item.description) descParts.push(item.description);
            if (item.size) descParts.push(`Talla: ${item.size}`);
            if (item.link) descParts.push(item.link);
            return {
              description: descParts.join(' · ') || 'Producto',
              quantity: qty,
              unit_price: Number(unitPrice.toFixed(2)),
              total: Number(lineTotal.toFixed(2)),
              details: { quote_item: item }
            };
          });

          const invoiceNumber = `PRES-${quote.quote_number || quote.token.slice(0, 8).toUpperCase()}`;
          invoiceCreated = await base44.asServiceRole.entities.Invoice.create({
            locked: true,
            lock_reason: INVOICE_IMMUTABLE_REASON,
            invoice_number: invoiceNumber,
            client_email: quote.client_email,
            consolidation_id: quote.id,
            consolidation_tracking: quote.quote_number || quote.token,
            invoice_date: now.toISOString(),
            due_date: dueDate.toISOString(),
            items,
            subtotal: Number(totalUsd.toFixed(2)),
            tax: 0,
            total: Number(totalUsd.toFixed(2)),
            paid_amount: 0,
            status: 'pendiente',
            notes: `Factura generada automáticamente desde el presupuesto ${quote.quote_number || quote.token}.`
          });
        }
      }
    } catch (err) {
      console.error('Error creando factura de presupuesto:', err);
    }

    // Notificar a administradores que el cliente aceptó el contrato
    await notifyAdminsOfContractAcceptance(base44, updated);

    return Response.json({ quote: updated, invoice: invoiceCreated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}