import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }

async function getSettings(base44) {
  const rows = await base44.asServiceRole.entities.ReferralSettings.filter({ config_key: 'main' });
  const s = rows[0] || {};
  const roleCodes = Array.isArray(s.agent_role_codes) ? s.agent_role_codes.map(x => String(x).toLowerCase()) : ['agente','agent'];
  return {
    enabled: s.enabled !== false,
    creditPerCbm: typeof s.referrer_credit_per_cbm === 'number' ? s.referrer_credit_per_cbm : 15,
    creditExpirationDays: typeof s.credit_expiration_days === 'number' ? s.credit_expiration_days : 60,
    agentEnabled: s.agent_enabled !== false,
    agentCreditPerCbm: typeof s.agent_referrer_credit_per_cbm === 'number' ? s.agent_referrer_credit_per_cbm : 25,
    agentRoleCodes: roleCodes,
  };
}

async function getInvoice(base44, invoiceId) {
  const rows = await base44.asServiceRole.entities.Invoice.filter({ id: invoiceId });
  return rows[0] || null;
}

async function getConsolidationCbm(base44, consolidationId) {
  if (!consolidationId) return 0;
  const rows = await base44.asServiceRole.entities.Consolidation.filter({ id: consolidationId });
  return rows[0]?.cbm || 0;
}

async function findUserByEmail(base44, email) {
  const rows = await base44.asServiceRole.entities.User.filter({ email });
  return rows[0] || null;
}

async function getActiveRewardByInvoice(base44, invoiceId) {
  const rows = await base44.asServiceRole.entities.ReferralCbmReward.filter({ invoice_id: invoiceId, status: 'active' });
  return rows[0] || null;
}

async function getUserById(base44, userId) {
  if (!userId) return null;
  const rows = await base44.asServiceRole.entities.User.filter({ id: userId });
  return rows[0] || null;
}

async function createLedgerCredit(base44, userId, amountUsd, invoiceId, expiresAt) {
  return await base44.asServiceRole.entities.CreditsLedger.create({
    user_id: userId,
    source: 'referral_cbm',
    amount_usd: amountUsd,
    status: 'available',
    related_invoice_id: invoiceId,
    expires_at: expiresAt?.toISOString?.() || null,
  });
}

async function createLedgerReversal(base44, userId, amountUsd, invoiceId, notes) {
  return await base44.asServiceRole.entities.CreditsLedger.create({
    user_id: userId,
    source: 'reversal',
    amount_usd: -Math.abs(amountUsd),
    status: 'reversed',
    related_invoice_id: invoiceId,
    notes: notes || 'Reversa de crédito por cambio o cancelación de factura',
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Strict auth: never allow silent auth failures before privileged operations. Admin only.
    let user = null;
    try { user = await base44.auth.me(); } catch { user = null; }
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));

    const settings = await getSettings(base44);
    if (!settings.enabled) {
      return Response.json({ skipped: true, reason: 'referrals disabled' });
    }

    let invoiceId = payload?.invoice_id || payload?.event?.entity_id;
    let entityName = payload?.event?.entity_name;

    // If coming from Consolidation update, locate related invoice (if any)
    if (!invoiceId && entityName === 'Consolidation' && payload?.data?.id) {
      const invs = await base44.asServiceRole.entities.Invoice.filter({ consolidation_id: payload.data.id });
      if (invs.length > 0) invoiceId = invs[0].id;
    }

    if (!invoiceId) {
      return Response.json({ error: 'invoice_id is required' }, { status: 400 });
    }

    const invoice = await getInvoice(base44, invoiceId);
    if (!invoice) return Response.json({ error: 'invoice not found' }, { status: 404 });

    const newStatus = invoice.status; // current persisted status
    const oldStatus = payload?.old_data?.status;

    // Map ISSUED -> 'pendiente' (emitida / no pagada)
    const isIssuedNow = newStatus === 'pendiente';
    const justIssued = isIssuedNow && oldStatus !== 'pendiente';
    const isCanceledNow = newStatus === 'cancelada' && oldStatus !== 'cancelada';

    // Get referred and referrer
    let referredUser = null;
    if (invoice.user_id) {
      const rows = await base44.asServiceRole.entities.User.filter({ id: invoice.user_id });
      referredUser = rows[0] || null;
    } else if (invoice.client_email) {
      referredUser = await findUserByEmail(base44, invoice.client_email);
    }

    if (!referredUser) {
      return Response.json({ skipped: true, reason: 'no referred user found on invoice' });
    }

    const referrerId = referredUser.referred_by_user_id || null;

    const activeReward = await getActiveRewardByInvoice(base44, invoice.id);

    // Handle cancellation reversal
    if (isCanceledNow && activeReward) {
      await base44.asServiceRole.entities.ReferralCbmReward.update(activeReward.id, { status: 'reversed' });
      await createLedgerReversal(base44, activeReward.referrer_user_id, activeReward.credit_generated, invoice.id, 'Factura cancelada');
      return Response.json({ success: true, action: 'reversed_on_cancel' });
    }

    // Only proceed if invoice is issued and user has a referrer
    if (!isIssuedNow || !referrerId) {
      return Response.json({ skipped: true, reason: 'not issued or no referrer' });
    }

    const cbm = await getConsolidationCbm(base44, invoice.consolidation_id);
    if (!cbm || cbm <= 0) {
      return Response.json({ skipped: true, reason: 'no cbm to reward' });
    }

    // Determine rate based on referrer role (agent vs regular)
    const refUser = await getUserById(base44, referrerId);
    const roleVal = String(refUser?.custom_role || refUser?.role || '').toLowerCase();
    const isAgent = settings.agentEnabled && roleVal && settings.agentRoleCodes.includes(roleVal);
    const rate = isAgent ? settings.agentCreditPerCbm : settings.creditPerCbm;
    const rewardUsd = cbm * rate;

    // If there is an active reward, check for CBM change and adjust
    if (activeReward) {
      if (Math.abs((activeReward.cbm_rewarded || 0) - cbm) > 1e-6) {
        // Reverse old and create new
        await base44.asServiceRole.entities.ReferralCbmReward.update(activeReward.id, { status: 'reversed' });
        await createLedgerReversal(base44, activeReward.referrer_user_id, activeReward.credit_generated, invoice.id, 'Recalculo por cambio de CBM');

        const newReward = await base44.asServiceRole.entities.ReferralCbmReward.create({
          invoice_id: invoice.id,
          referrer_user_id: referrerId,
          referred_user_id: referredUser.id,
          cbm_rewarded: cbm,
          credit_generated: rewardUsd,
          status: 'active'
        });
        const expiresAt = addDays(new Date(), settings.creditExpirationDays);
        await createLedgerCredit(base44, referrerId, rewardUsd, invoice.id, expiresAt);
        return Response.json({ success: true, action: 'recalculated', reward_id: newReward.id, amount: rewardUsd });
      }
      // No change needed
      return Response.json({ skipped: true, reason: 'duplicate_issue_no_change' });
    }

    // No prior reward: create on first issue
    if (justIssued || entityName === 'Consolidation') {
      const reward = await base44.asServiceRole.entities.ReferralCbmReward.create({
        invoice_id: invoice.id,
        referrer_user_id: referrerId,
        referred_user_id: referredUser.id,
        cbm_rewarded: cbm,
        credit_generated: rewardUsd,
        status: 'active'
      });
      const expiresAt = addDays(new Date(), settings.creditExpirationDays);
      await createLedgerCredit(base44, referrerId, rewardUsd, invoice.id, expiresAt);
      return Response.json({ success: true, action: 'created', reward_id: reward.id, amount: rewardUsd });
    }

    return Response.json({ skipped: true, reason: 'already issued previously' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});