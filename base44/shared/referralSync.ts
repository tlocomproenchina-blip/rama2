// Lógica del programa de referidos: atribución, maduración y acumulación de CBM.
export const USD_PER_BLOCK = 50;
const SHIPPED_STATUSES = ['en_transito', 'disponible', 'despachado', 'entregado'];

const round4 = (n: number) => Math.round((Number(n) || 0) * 10000) / 10000;

export function invoiceCbm(inv: any): number {
  return round4(Number(inv?.billed_cbm) || Number(inv?.total_cbm) || Number(inv?.cost_breakdown?.total_cbm) || 0);
}

function invoiceTrackings(inv: any): string[] {
  const out: string[] = [];
  for (const r of inv?.manual_recibos || []) for (const t of r?.tracking_numbers || []) if (t) out.push(String(t));
  return out;
}

async function invoicePackages(sr: any, inv: any) {
  const trackings = invoiceTrackings(inv);
  if (!trackings.length) return [];
  return await sr.entities.Package.filter({ client_email: inv.client_email, tracking_number: { $in: trackings.slice(0, 200) } }, '-created_date', 200);
}

// Primera vinculación: valida autorreferido y vinculación extemporánea.
export async function linkReferral(sr: any, me: any, code: string) {
  if (me.referred_by_user_id) return { error: 'Tu cuenta ya tiene un referidor registrado.', status: 409 };
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return { error: 'Indica un código de referidor.', status: 400 };
  // Todo cliente registrado tiene un código propio (User.referral_code).
  const owner = (await sr.entities.User.filter({ referral_code: clean }))[0];
  const profile = owner
    ? (await sr.entities.ReferrerProfile.filter({ user_id: owner.id }, '-created_date', 1))[0]
    : (await sr.entities.ReferrerProfile.filter({ referral_code: clean, status: 'activo' }, '-created_date', 1))[0];
  if (!owner && !profile) return { error: 'El código de referido no existe.', status: 404 };
  const ref = {
    user_id: owner?.id || profile.user_id,
    user_email: owner?.email || profile.user_email,
    contact_email: profile?.contact_email || '',
    phone: profile?.phone || owner?.whatsapp || owner?.phone || '',
    full_name: profile?.full_name || [owner?.first_name, owner?.last_name].filter(Boolean).join(' ') || owner?.full_name || 'Cliente TLEC',
  };
  const myPhone = String(me.whatsapp || me.phone || '').replace(/\D/g, '');
  const refPhone = String(ref.phone || '').replace(/\D/g, '');
  if (ref.user_id === me.id || ref.user_email === me.email || ref.contact_email === me.email || (myPhone && myPhone === refPhone)) {
    return { error: 'No se permiten autorreferencias.', status: 400 };
  }
  const [pkgs, invoices] = await Promise.all([
    sr.entities.Package.filter({ client_email: me.email }, '-created_date', 500),
    sr.entities.Invoice.filter({ client_email: me.email }, '-created_date', 1),
  ]);
  const late = pkgs.some((p: any) => SHIPPED_STATUSES.includes(p.status) || p.ve_recognized_date);
  if (late || invoices.length) {
    return { error: 'Ya tienes carga zarpada, recibida en destino o facturada: la vinculación ya no es posible.', status: 400 };
  }
  const first = await sr.entities.Package.filter({ client_email: me.email }, 'created_date', 1);
  await sr.entities.User.update(me.id, {
    referred_by_user_id: ref.user_id,
    referral_joined_at: new Date().toISOString(),
    referral_code_used: clean,
    referral_first_order: first[0]?.tracking_number || 'Sin guía aún',
  });
  return { success: true, referrer_name: ref.full_name };
}

async function notify(sr: any, email: string, title: string, message: string, refId: string) {
  await sr.entities.Notification.create({ user_email: email, title, message, type: 'system', icon: 'check', reference_id: refId, entity_type: 'Invoice' });
}

export async function accumulatedCbm(sr: any, referrerId: string) {
  const rows = await sr.entities.ReferralShipment.filter({ referrer_user_id: referrerId, counted: true }, '-created_date', 1000);
  return round4(rows.reduce((s: number, r: any) => s + (Number(r.cbm) || 0), 0));
}

// Sincroniza una factura del cliente referido con su registro de seguimiento.
export async function syncInvoice(sr: any, inv: any) {
  if (!inv?.client_email) return { skipped: 'sin cliente' };
  const users = await sr.entities.User.filter({ email: inv.client_email });
  const client = users[0];
  if (!client?.referred_by_user_id) return { skipped: 'sin referidor' };
  if (client.referral_joined_at && inv.invoice_date && inv.invoice_date < client.referral_joined_at) return { skipped: 'anterior a la vinculación' };
  const refs = await sr.entities.ReferrerProfile.filter({ user_id: client.referred_by_user_id }, '-created_date', 1);
  const ref = refs[0];
  if (!ref) return { skipped: 'referidor sin registro' };

  const pkgs = await invoicePackages(sr, inv);
  const cbm = invoiceCbm(inv);
  let status = 'in_transit';
  let reason = '';
  const arrivedPkg = pkgs.find((p: any) => p.ve_recognized_date);
  const arrived = !!arrivedPkg || !!inv.dispatched;
  if (inv.status === 'cancelada') { status = 'excluded'; reason = 'Factura cancelada'; }
  else if (pkgs.some((p: any) => p.shipping_type === 'aereo')) { status = 'excluded'; reason = 'Envío aéreo'; }
  else if (ref.status === 'suspendido') { status = 'excluded'; reason = 'Referidor suspendido'; }
  else if (cbm <= 0) { status = 'excluded'; reason = 'Sin CBM facturado'; }
  else if (arrived && inv.status === 'pagada') status = 'paid';
  else if (arrived) status = 'arrived';

  const existing = (await sr.entities.ReferralShipment.filter({ invoice_id: inv.id }, '-created_date', 1))[0];
  if (existing?.counted && existing.status === 'paid' && status === 'paid') return { unchanged: true };
  const name = [client.first_name, client.last_name].filter(Boolean).join(' ') || client.full_name || client.email;
  const data: any = {
    invoice_id: inv.id, invoice_number: inv.invoice_number, invoice_date: inv.invoice_date,
    referrer_user_id: ref.user_id, referrer_email: ref.user_email,
    referred_user_id: client.id, referred_email: client.email, referred_name: name,
    cbm, status, exclusion_reason: reason,
    arrived_date: existing?.arrived_date || (arrived ? (arrivedPkg?.ve_recognized_date || new Date().toISOString()) : null),
  };
  const becameCounted = status === 'paid' && !existing?.counted;
  const reversed = existing?.counted && status !== 'paid';
  if (becameCounted) { data.counted = true; data.counted_date = new Date().toISOString(); }
  if (reversed) { data.counted = false; }
  const row = existing ? await sr.entities.ReferralShipment.update(existing.id, data) : await sr.entities.ReferralShipment.create(data);

  if (becameCounted || reversed) {
    const total = await accumulatedCbm(sr, ref.user_id);
    const msg = becameCounted
      ? `Tu referido pagó su carga (+${cbm.toFixed(2)} CBM). Acumulas: ${total.toFixed(2)} CBM.`
      : `Se retiraron ${cbm.toFixed(2)} CBM de la factura ${inv.invoice_number || ''} (${reason || 'ya no cumple las condiciones'}). Acumulas: ${total.toFixed(2)} CBM.`;
    await notify(sr, ref.user_email, becameCounted ? 'Referido: CBM sumado' : 'Referido: ajuste de CBM', msg, inv.id);
  }
  return { status, cbm, counted: !!row?.counted };
}