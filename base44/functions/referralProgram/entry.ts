import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { linkReferral, syncInvoice, accumulatedCbm, invoiceCbm, USD_PER_BLOCK, PROGRAM_START, afterStart } from '../../shared/referralSync.ts';

const METHODS = ['credito', 'usdt_trc20', 'usdt_bep20', 'pago_movil', 'efectivo'];

function addBusinessDays(d: Date, n: number) {
  const r = new Date(d);
  while (n > 0) { r.setDate(r.getDate() + 1); const w = r.getDay(); if (w !== 0 && w !== 6) n--; }
  return r;
}

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'TLEC-' + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function balance(sr: any, userId: string) {
  const acc = await accumulatedCbm(sr, userId);
  const reqs = (await sr.entities.ReferralPayoutRequest.filter({ referrer_user_id: userId }, '-created_date', 500)).filter((r: any) => afterStart(r.created_date));
  const used = reqs.filter((r: any) => r.status !== 'rechazada').reduce((s: number, r: any) => s + (Number(r.cbm) || 0), 0);
  const free = Math.max(0, Math.round((acc - used) * 10000) / 10000);
  return { accumulated: acc, used, free, blocks: Math.floor(free), requests: reqs };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const sr = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const { action } = body;
    const isAdmin = me.role === 'admin';
    const now = new Date().toISOString();

    if (action === 'me') {
      const profile = (await sr.entities.ReferrerProfile.filter({ user_id: me.id }, '-created_date', 1))[0] || null;
      const shipments = (await sr.entities.ReferralShipment.filter({ referrer_user_id: me.id }, '-created_date', 300)).filter((s: any) => afterStart(s.created_date));
      const referred = (await sr.entities.User.filter({ referred_by_user_id: me.id }, '-created_date', 300)).filter((u: any) => afterStart(u.referral_joined_at));
      const b = await balance(sr, me.id);
      let myCode = me.referral_code;
      if (!myCode) {
        myCode = genCode();
        for (let i = 0; i < 5 && (await sr.entities.User.filter({ referral_code: myCode })).length; i++) myCode = genCode();
        await sr.entities.User.update(me.id, { referral_code: myCode });
      }
      // CBM enviado por cada referido desde que se vinculó
      const cbmBy: Record<string, number> = {};
      const emails = referred.map((u: any) => u.email).filter(Boolean);
      if (emails.length) {
        const invs = await sr.entities.Invoice.filter({ client_email: { $in: emails }, status: { $ne: 'cancelada' } }, '-created_date', 2000);
        const joinedBy: Record<string, string> = Object.fromEntries(referred.map((u: any) => [u.email, u.referral_joined_at || '']));
        for (const inv of invs) {
          const j = joinedBy[inv.client_email];
          if (j && inv.invoice_date && inv.invoice_date < j) continue;
          if (!afterStart(inv.invoice_date || inv.created_date)) continue;
          cbmBy[inv.client_email] = (cbmBy[inv.client_email] || 0) + invoiceCbm(inv);
        }
      }
      let referrer = null;
      if (me.referred_by_user_id) {
        const p = (await sr.entities.ReferrerProfile.filter({ user_id: me.referred_by_user_id }, '-created_date', 1))[0];
        const ru = p ? null : (await sr.entities.User.filter({ id: me.referred_by_user_id }))[0];
        referrer = p
          ? { name: p.full_name, code: p.referral_code }
          : { name: [ru?.first_name, ru?.last_name].filter(Boolean).join(' ') || ru?.full_name || 'Cliente TLEC', code: me.referral_code_used || '' };
      }
      return Response.json({
        profile, shipments, balance: { ...b, requests: undefined }, requests: b.requests, referrer,
        eligible: me.role === 'user' && me.is_active !== false,
        my_code: myCode,
        program_start: PROGRAM_START,
        referred: referred.map((u: any) => ({
          id: u.id,
          name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.full_name || 'Cliente en registro',
          joined: u.referral_joined_at || u.created_date,
          cbm: Math.round((cbmBy[u.email] || 0) * 10000) / 10000,
        })),
      });
    }

    if (action === 'register') {
      if (me.is_active === false) return Response.json({ error: 'Solo clientes activos pueden participar.' }, { status: 403 });
      const { full_name, id_number, phone, contact_email, accept_terms } = body;
      if (!full_name || !id_number || !phone || !contact_email) return Response.json({ error: 'Completa todos los datos.' }, { status: 400 });
      if (!accept_terms) return Response.json({ error: 'Debes aceptar los términos del programa.' }, { status: 400 });
      const mine = (await sr.entities.ReferrerProfile.filter({ user_id: me.id }, '-created_date', 1))[0];
      if (mine && mine.status !== 'rechazado') return Response.json({ error: 'Ya tienes un registro en el programa.' }, { status: 409 });
      const dupId = await sr.entities.ReferrerProfile.filter({ id_number: String(id_number).trim(), status: { $ne: 'rechazado' } }, '-created_date', 1);
      if (dupId.length && dupId[0].user_id !== me.id) return Response.json({ error: 'Esa identificación ya está registrada en otra cuenta.' }, { status: 409 });
      const data = { user_id: me.id, user_email: me.email, full_name, id_number: String(id_number).trim(), phone, contact_email, status: 'pendiente', terms_accepted_date: now };
      const p = mine ? await sr.entities.ReferrerProfile.update(mine.id, data) : await sr.entities.ReferrerProfile.create(data);
      return Response.json({ profile: p });
    }

    if (action === 'link') {
      const r: any = await linkReferral(sr, me, body.code);
      if (r.error) return Response.json({ error: r.error }, { status: r.status || 400 });
      return Response.json(r);
    }

    if (action === 'request_payout') {
      const profile = (await sr.entities.ReferrerProfile.filter({ user_id: me.id }, '-created_date', 1))[0];
      if (profile?.status === 'suspendido') return Response.json({ error: 'Tu participación está suspendida.' }, { status: 403 });
      if (me.is_active === false) return Response.json({ error: 'Tu cuenta está desactivada.' }, { status: 403 });
      const { method, payout_details } = body;
      const blocks = Math.floor(Number(body.blocks) || 0);
      if (!METHODS.includes(method)) return Response.json({ error: 'Método inválido.' }, { status: 400 });
      if (method !== 'credito' && method !== 'efectivo' && !String(payout_details || '').trim()) return Response.json({ error: 'Indica los datos para recibir el pago.' }, { status: 400 });
      const b = await balance(sr, me.id);
      if (blocks < 1 || blocks > b.blocks) return Response.json({ error: `Puedes solicitar hasta ${b.blocks} bloque(s).` }, { status: 400 });
      const r = await sr.entities.ReferralPayoutRequest.create({
        referrer_user_id: me.id, referrer_email: me.email, referrer_name: profile?.full_name || [me.first_name, me.last_name].filter(Boolean).join(' ') || me.full_name || me.email,
        blocks, cbm: blocks, amount: blocks * USD_PER_BLOCK, method, payout_details: payout_details || '', status: 'pendiente',
      });
      return Response.json({ request: r });
    }

    if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    if (action === 'admin_list') {
      const [profiles, requests, shipments] = await Promise.all([
        sr.entities.ReferrerProfile.list('-created_date', 500),
        sr.entities.ReferralPayoutRequest.list('-created_date', 500),
        sr.entities.ReferralShipment.list('-created_date', 500),
      ]);
      const totals: Record<string, number> = {};
      for (const s of shipments) if (s.counted) totals[s.referrer_user_id] = (totals[s.referrer_user_id] || 0) + (Number(s.cbm) || 0);
      return Response.json({ profiles: profiles.map((p: any) => ({ ...p, accumulated_cbm: Math.round((totals[p.user_id] || 0) * 10000) / 10000 })), requests, shipments });
    }

    if (action === 'admin_review_profile') {
      const { id, decision, notes } = body;
      const p = (await sr.entities.ReferrerProfile.filter({ id }))[0];
      if (!p) return Response.json({ error: 'No encontrado' }, { status: 404 });
      if (!['activo', 'rechazado', 'suspendido'].includes(decision)) return Response.json({ error: 'Decisión inválida' }, { status: 400 });
      const data: any = { status: decision, reviewed_by: me.email, reviewed_date: now, review_notes: notes || '' };
      if (decision === 'activo' && !p.referral_code) {
        let code = genCode();
        for (let i = 0; i < 5 && (await sr.entities.ReferrerProfile.filter({ referral_code: code })).length; i++) code = genCode();
        data.referral_code = code;
        await sr.entities.User.update(p.user_id, { referral_code: code });
      }
      const up = await sr.entities.ReferrerProfile.update(id, data);
      const labels: any = { activo: 'Tu registro como referidor fue aprobado. Ya puedes compartir tu código.', rechazado: 'Tu registro como referidor fue rechazado.', suspendido: 'Tu participación en el programa de referidos fue suspendida.' };
      await sr.entities.Notification.create({ user_email: p.user_email, title: 'Programa de referidos', message: labels[decision] + (notes ? ` ${notes}` : ''), type: 'system', icon: 'check', entity_type: 'System' });
      return Response.json({ profile: up });
    }

    if (action === 'admin_review_payout') {
      const { id, decision, notes, payment_reference } = body;
      const r = (await sr.entities.ReferralPayoutRequest.filter({ id }))[0];
      if (!r) return Response.json({ error: 'No encontrada' }, { status: 404 });
      const data: any = { reviewed_by: me.email, reviewed_date: now, admin_notes: notes || r.admin_notes || '' };
      if (decision === 'rechazada' && r.status === 'pendiente') data.status = 'rechazada';
      else if (decision === 'aprobada' && r.status === 'pendiente') {
        if (r.method === 'credito') {
          await sr.entities.ClientCredit.create({ client_email: r.referrer_email, amount: r.amount, type: 'credito', description: `Recompensa de referidos (${r.blocks} CBM)`, reference: `REF-${r.id}`, created_by_email: me.email });
          data.status = 'pagada'; data.paid_date = now; data.payment_reference = 'Saldo a favor';
        } else { data.status = 'aprobada'; data.due_date = addBusinessDays(new Date(), 5).toISOString(); }
      } else if (decision === 'pagada' && r.status === 'aprobada') {
        data.status = 'pagada'; data.paid_date = now; data.payment_reference = payment_reference || '';
      } else return Response.json({ error: 'Transición no válida' }, { status: 400 });
      const up = await sr.entities.ReferralPayoutRequest.update(id, data);
      const msg: any = { rechazada: 'Tu solicitud de cobro fue rechazada.', aprobada: 'Tu solicitud de cobro fue aprobada y se procesará en máximo 5 días hábiles.', pagada: `Tu recompensa de $${r.amount} fue pagada.` };
      await sr.entities.Notification.create({ user_email: r.referrer_email, title: 'Cobro de referidos', message: msg[data.status] + (notes ? ` ${notes}` : ''), type: 'payment', icon: 'check', entity_type: 'System' });
      return Response.json({ request: up });
    }

    if (action === 'admin_sync') {
      const referred = (await sr.entities.User.list('-created_date', 5000)).filter((u: any) => u.referred_by_user_id);
      let processed = 0;
      for (const u of referred) {
        if (!u.referred_by_user_id) continue;
        const invs = await sr.entities.Invoice.filter({ client_email: u.email }, '-created_date', 100);
        for (const inv of invs) { await syncInvoice(sr, inv); processed++; }
      }
      return Response.json({ processed });
    }

    return Response.json({ error: 'Acción desconocida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});