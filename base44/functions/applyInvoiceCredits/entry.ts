import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function minDefined(a, b) { if (typeof a !== 'number') return b; if (typeof b !== 'number') return a < b ? a : b; return Math.min(a, b); }

async function getSettings(base44) {
  const rows = await base44.asServiceRole.entities.ReferralSettings.filter({ config_key: 'main' });
  const s = rows[0] || {};
  return {
    maxPercent: typeof s.max_credit_apply_percent === 'number' ? s.max_credit_apply_percent : 0.3,
    maxUsd: typeof s.max_credit_apply_usd === 'number' ? s.max_credit_apply_usd : null,
    minSubtotal: typeof s.min_invoice_subtotal_usd === 'number' ? s.min_invoice_subtotal_usd : 95,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (_) { user = null; }
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const invoiceId = payload?.invoice_id || payload?.event?.entity_id;
    if (!invoiceId) return Response.json({ error: 'invoice_id is required' }, { status: 400 });

    const invRows = await base44.asServiceRole.entities.Invoice.filter({ id: invoiceId });
    const invoice = invRows[0];
    if (!invoice) return Response.json({ error: 'invoice not found' }, { status: 404 });

    // Only admins or the invoice owner may apply credits
    const isOwner = invoice.client_email && user.email === invoice.client_email;
    if (user.role !== 'admin' && !isOwner) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const settings = await getSettings(base44);
    const subtotal = typeof invoice.subtotal === 'number' ? invoice.subtotal : (typeof invoice.subtotal_usd === 'number' ? invoice.subtotal_usd : 0);
    if (subtotal <= 0) return Response.json({ skipped: true, reason: 'no subtotal' });

    if (subtotal < settings.minSubtotal) {
      // Ensure credit field is zeroed if present
      await base44.asServiceRole.entities.Invoice.update(invoice.id, { discount_credit_applied_usd: 0, total: subtotal });
      return Response.json({ skipped: true, reason: 'below minimum subtotal' });
    }

    // Sum available credits for this user (not expired)
    const nowIso = new Date().toISOString();
    const all = await base44.asServiceRole.entities.CreditsLedger.filter({ user_id: invoice.user_id || undefined, status: 'available' });
    const available = (all || []).filter(c => !c.expires_at || c.expires_at > nowIso);
    const availableTotal = available.reduce((sum, c) => sum + (Number(c.amount_usd) || 0), 0);

    if (availableTotal <= 0) {
      await base44.asServiceRole.entities.Invoice.update(invoice.id, { discount_credit_applied_usd: 0, total: subtotal });
      return Response.json({ skipped: true, reason: 'no available credits' });
    }

    const capPercent = subtotal * settings.maxPercent;
    const cap = settings.maxUsd != null ? Math.min(capPercent, settings.maxUsd) : capPercent;
    const applyAmount = Math.min(availableTotal, cap);

    const newTotal = Math.max(0, subtotal - applyAmount);

    await base44.asServiceRole.entities.Invoice.update(invoice.id, {
      discount_credit_applied_usd: applyAmount,
      total: newTotal
    });

    // Mark entries as applied up to applyAmount (FIFO)
    let remaining = applyAmount;
    for (const entry of available.sort((a,b) => new Date(a.created_date) - new Date(b.created_date))) {
      if (remaining <= 1e-6) break;
      const take = Math.min(remaining, Number(entry.amount_usd) || 0);
      remaining -= take;
      await base44.asServiceRole.entities.CreditsLedger.update(entry.id, {
        status: 'applied',
        related_invoice_id: invoice.id
      });
    }

    return Response.json({ success: true, applied: applyAmount, total_after: newTotal });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});