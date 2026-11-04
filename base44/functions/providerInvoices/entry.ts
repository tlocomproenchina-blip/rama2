import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { uploadBase64ToBunny, BunnyUploadError } from '../../shared/bunnyUpload.ts';
import { searchClientsByQuery } from '../../shared/bultoScan.ts';

// Facturas de proveedor. Acciones: config, setRate, searchClients, upload, create, list, markPaid, public.
const isProvider = (u: any) => String(u?.custom_role || '').trim().toLowerCase() === 'proveedor';
const canUse = (u: any) => u && (u.role === 'admin' || isProvider(u));
const isFullAdmin = (u: any) => u?.role === 'admin' && !u?.custom_role;
const round = (n: number) => Math.round(n * 100) / 100;

async function currentRate(sr: any) {
  const rows = await sr.entities.ProviderInvoiceRate.list('-created_date', 1);
  return Number(rows?.[0]?.flat_rate || 0);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === 'public') {
      if (!body.token || String(body.token).length < 20) return Response.json({ error: 'No encontrada' }, { status: 404 });
      const rows = await sr.entities.ProviderInvoice.filter({ public_token: String(body.token) }, '-created_date', 1);
      const inv = rows?.[0];
      if (!inv) return Response.json({ error: 'No encontrada' }, { status: 404 });
      const { created_by_email, paid_by, client_email, ...safe } = inv;
      return Response.json({ invoice: safe });
    }

    const user = await base44.auth.me().catch(() => null);
    if (!canUse(user)) return Response.json({ error: 'Sin acceso' }, { status: 403 });

    if (action === 'config') {
      return Response.json({ flat_rate: await currentRate(sr), is_admin: isFullAdmin(user) });
    }
    if (action === 'setRate') {
      if (!isFullAdmin(user)) return Response.json({ error: 'Solo el administrador' }, { status: 403 });
      const rate = Number(body.flat_rate);
      if (!(rate > 0)) return Response.json({ error: 'Tarifa inválida' }, { status: 400 });
      await sr.entities.ProviderInvoiceRate.create({ flat_rate: rate, set_by: user.email });
      return Response.json({ flat_rate: rate });
    }
    if (action === 'searchClients') {
      return Response.json({ clients: await searchClientsByQuery(sr, body.query) });
    }
    if (action === 'upload') {
      const ext = String(body.ext || 'jpg');
      if (!['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(ext)) return Response.json({ error: 'Formato no permitido' }, { status: 400 });
      return Response.json({ url: await uploadBase64ToBunny(String(body.base64 || ''), ext) });
    }
    if (action === 'create') {
      const d = body.data || {};
      const cbm = Number(d.cbm);
      if (!d.invoice_code || !d.shipping_mark || !(cbm > 0)) return Response.json({ error: 'Faltan datos obligatorios' }, { status: 400 });
      const rate = await currentRate(sr);
      if (!(rate > 0)) return Response.json({ error: 'El administrador aún no configuró la tarifa plana' }, { status: 400 });
      const other = (Array.isArray(d.other_expenses) ? d.other_expenses : [])
        .map((e: any) => ({ description: String(e.description || ''), amount: Number(e.amount) || 0 }))
        .filter((e: any) => e.description || e.amount);
      const otherTotal = round(other.reduce((s: number, e: any) => s + e.amount, 0));
      const invoice = await sr.entities.ProviderInvoice.create({
        invoice_code: String(d.invoice_code).trim(),
        client_email: d.client_email || '', client_name: d.client_name || '', shipping_mark: d.shipping_mark,
        load_date: d.load_date || null, flat_rate: rate, cbm, other_expenses: other, other_total: otherTotal,
        total: round(rate * cbm + otherTotal), invoice_file_url: d.invoice_file_url || '', status: 'pendiente',
        public_token: crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''),
        created_by_email: user.email, created_by_name: user.full_name || '',
      });
      return Response.json({ invoice });
    }
    if (action === 'list') {
      const q: any = {};
      if (body.status && body.status !== 'todas') q.status = body.status;
      if (body.from || body.to) {
        q.load_date = {};
        if (body.from) q.load_date.$gte = body.from;
        if (body.to) q.load_date.$lte = body.to;
      }
      if (body.client) {
        const re = String(body.client).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        q.$or = [{ shipping_mark: { $regex: re, $options: 'i' } }, { client_name: { $regex: re, $options: 'i' } }, { invoice_code: { $regex: re, $options: 'i' } }];
      }
      const items = await sr.entities.ProviderInvoice.filter(q, '-created_date', 200);
      return Response.json({ items });
    }
    if (action === 'markPaid') {
      if (!isFullAdmin(user)) return Response.json({ error: 'Solo el administrador' }, { status: 403 });
      const patch: any = { status: body.paid === false ? 'pendiente' : 'pagada' };
      if (body.payment_proof_url) patch.payment_proof_url = body.payment_proof_url;
      if (patch.status === 'pagada') { patch.paid_date = new Date().toISOString(); patch.paid_by = user.email; }
      const invoice = await sr.entities.ProviderInvoice.update(body.id, patch);
      return Response.json({ invoice });
    }
    return Response.json({ error: 'Acción inválida' }, { status: 400 });
  } catch (error: any) {
    const status = error instanceof BunnyUploadError ? error.status : 500;
    return Response.json({ error: error.message }, { status });
  }
});