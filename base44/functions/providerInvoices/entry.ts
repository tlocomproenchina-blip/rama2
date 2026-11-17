import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { uploadBase64ToBunny, BunnyUploadError } from '../../shared/bunnyUpload.ts';
import { searchClientsByQuery } from '../../shared/bultoScan.ts';
import { passwordFields, passwordError, passwordDenied } from '../../shared/accessPassword.ts';

// Facturas de proveedor. Acciones: config, setRate, searchClients, upload, create, list, markPaid, public.
const isProvider = (u: any) => String(u?.custom_role || '').trim().toLowerCase() === 'proveedor';
const canUse = (u: any) => u && (u.role === 'admin' || isProvider(u));
const isFullAdmin = (u: any) => u?.role === 'admin' && !isProvider(u);
const round = (n: number) => Math.round(n * 100) / 100;

async function currentRate(sr: any) {
  const rows = await sr.entities.ProviderInvoiceRate.list('-created_date', 1);
  return Number(rows?.[0]?.flat_rate || 0);
}

const EPS = 0.005;
const sumOf = (rows: any[]) => round((rows || []).reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0));

// Abonos de una factura, del más antiguo al más reciente.
async function installmentsFor(sr: any, ids: string[]) {
  if (!ids.length) return [];
  const rows = await sr.entities.ProviderInvoiceInstallment.filter({ invoice_id: { $in: ids } }, 'created_date', 5000);
  return rows || [];
}

// Agrega a la factura lo abonado y el saldo restante.
function withBalance(inv: any, rows: any[]) {
  const paidAbonos = sumOf(rows);
  const total = Number(inv.total) || 0;
  const paid = inv.status === 'pagada';
  inv.installments = rows.map((r: any) => ({
    id: r.id, amount: r.amount, payment_date: r.payment_date, proof_url: r.proof_url, registered_by_name: r.registered_by_name || '',
  }));
  inv.paid_amount = paid ? total : Math.min(paidAbonos, total);
  inv.balance = paid ? 0 : Math.max(round(total - paidAbonos), 0);
  return inv;
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

    let user = null;
    if (body.portal_token) {
      // Enlace público del portal: solo historial, búsqueda de clientes, carga de archivos y creación.
      if (!['config', 'searchClients', 'upload', 'create', 'list', 'update', 'delete'].includes(action) || String(body.portal_token).length < 20) {
        return Response.json({ error: 'Sin acceso' }, { status: 403 });
      }
      const links = await sr.entities.ProviderPortalLink.filter({ token: String(body.portal_token), active: true }, '-created_date', 1);
      if (!links?.[0]) return Response.json({ error: 'Enlace inválido' }, { status: 403 });
      const denied = await passwordError(links[0], body.portal_password);
      if (denied) return passwordDenied(denied);
      user = { email: 'portal-proveedor', full_name: 'Portal de proveedor', custom_role: 'proveedor' };
    } else {
      user = await base44.auth.me().catch(() => null);
      if (!canUse(user)) return Response.json({ error: 'Sin acceso' }, { status: 403 });
    }

    if (action === 'getPortalLink' || action === 'regeneratePortalLink') {
      if (!isFullAdmin(user)) return Response.json({ error: 'Solo el administrador' }, { status: 403 });
      const existing = await sr.entities.ProviderPortalLink.filter({ active: true }, '-created_date', 1);
      const prev = existing?.[0];
      if (action === 'getPortalLink' && prev) return Response.json({ token: prev.token, password_set: !!prev.access_password_hash });
      if (prev) await sr.entities.ProviderPortalLink.updateMany({ active: true }, { $set: { active: false } });
      const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      // Al regenerar se conserva la contraseña del enlace anterior.
      await sr.entities.ProviderPortalLink.create({
        token, active: true, created_by: user.email,
        access_password_hash: prev?.access_password_hash || '', access_password_salt: prev?.access_password_salt || '',
      });
      return Response.json({ token, password_set: !!prev?.access_password_hash });
    }

    if (action === 'setPortalPassword') {
      if (!isFullAdmin(user)) return Response.json({ error: 'Solo el administrador' }, { status: 403 });
      const rows = await sr.entities.ProviderPortalLink.filter({ active: true }, '-created_date', 1);
      if (!rows?.[0]) return Response.json({ error: 'Primero genera el enlace del portal' }, { status: 400 });
      const fields = await passwordFields(body.password);
      await sr.entities.ProviderPortalLink.update(rows[0].id, fields);
      return Response.json({ password_set: !!fields.access_password_hash });
    }

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
      const clients = await searchClientsByQuery(base44, body.query);
      return Response.json({ clients: clients.map((c: any) => ({ email: c.email, shipping_mark: c.shipping_mark, full_name: c.full_name })) });
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
      // Filtro por estado del cliente (el estado vive en el usuario, no en la factura).
      if (body.state && body.state !== 'todos') {
        const allUsers = await sr.entities.User.list('-created_date', 5000);
        const emails = (allUsers || []).filter((u: any) => u.state === body.state).map((u: any) => u.email).filter(Boolean);
        if (!emails.length) return Response.json({ items: [], totals: { pending: 0, paid: 0, pending_count: 0, paid_count: 0 } });
        q.client_email = { $in: emails };
      }
      const items = await sr.entities.ProviderInvoice.filter(q, '-created_date', 200);
      // Estado, ciudad y dirección del cliente para mostrarlos en la tarjeta.
      const clientEmails = [...new Set(items.map((i: any) => i.client_email).filter(Boolean))];
      if (clientEmails.length) {
        const users = await sr.entities.User.filter({ email: { $in: clientEmails } }, '-created_date', 2000);
        const byEmail: any = {};
        for (const u of users || []) byEmail[String(u.email).toLowerCase()] = u;
        for (const i of items) {
          const u = byEmail[String(i.client_email || '').toLowerCase()];
          if (u) { i.client_state = u.state || ''; i.client_city = u.city || ''; i.client_address = u.address || ''; }
        }
      }
      const allRows = await installmentsFor(sr, items.map((i: any) => i.id));
      const rowsByInvoice: any = {};
      for (const r of allRows) (rowsByInvoice[r.invoice_id] ||= []).push(r);
      for (const i of items) withBalance(i, rowsByInvoice[i.id] || []);
      const totals = { pending: 0, paid: 0, pending_count: 0, paid_count: 0 };
      for (const i of items) {
        if (i.status === 'pagada') { totals.paid += Number(i.total) || 0; totals.paid_count++; }
        else { totals.pending += i.balance; totals.pending_count++; }
      }
      totals.pending = round(totals.pending); totals.paid = round(totals.paid);
      return Response.json({ items, totals });
    }
    if (action === 'paidReport') {
      // Facturas marcadas como pagadas; el período se aplica sobre la fecha de pago.
      const q: any = { status: 'pagada' };
      if (body.from || body.to) {
        q.paid_date = {};
        if (body.from) q.paid_date.$gte = `${body.from}T00:00:00.000Z`;
        if (body.to) q.paid_date.$lte = `${body.to}T23:59:59.999Z`;
      }
      if (body.client) {
        const re = String(body.client).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        q.$or = [{ shipping_mark: { $regex: re, $options: 'i' } }, { client_name: { $regex: re, $options: 'i' } }, { invoice_code: { $regex: re, $options: 'i' } }];
      }
      const items = await sr.entities.ProviderInvoice.filter(q, 'paid_date', 5000);
      // Si la factura no guardó comprobante propio, se usa el del último abono.
      const noProof = items.filter((i: any) => !i.payment_proof_url).map((i: any) => i.id);
      const proofByInvoice: any = {};
      for (const r of await installmentsFor(sr, noProof)) if (r.proof_url) proofByInvoice[r.invoice_id] = r.proof_url;
      return Response.json({
        items: items.map((i: any) => ({
          id: i.id, invoice_code: i.invoice_code, shipping_mark: i.shipping_mark || '', client_name: i.client_name || '',
          client_email: i.client_email || '', cbm: Number(i.cbm) || 0, total: Number(i.total) || 0, paid_date: i.paid_date || null,
          payment_proof_url: i.payment_proof_url || proofByInvoice[i.id] || '',
        })),
      });
    }
    if (action === 'update') {
      const d = body.data || {};
      const cbm = Number(d.cbm);
      if (!body.id || !d.invoice_code || !d.shipping_mark || !(cbm > 0)) return Response.json({ error: 'Faltan datos obligatorios' }, { status: 400 });
      const current = await sr.entities.ProviderInvoice.get(body.id);
      const other = (Array.isArray(d.other_expenses) ? d.other_expenses : [])
        .map((e: any) => ({ description: String(e.description || ''), amount: Number(e.amount) || 0 }))
        .filter((e: any) => e.description || e.amount);
      const otherTotal = round(other.reduce((s: number, e: any) => s + e.amount, 0));
      const rate = Number(current.flat_rate) || await currentRate(sr);
      const invoice = await sr.entities.ProviderInvoice.update(body.id, {
        invoice_code: String(d.invoice_code).trim(),
        client_email: d.client_email || '', client_name: d.client_name || '', shipping_mark: d.shipping_mark,
        load_date: d.load_date || null, cbm, other_expenses: other, other_total: otherTotal,
        total: round(rate * cbm + otherTotal), invoice_file_url: d.invoice_file_url || '',
      });
      return Response.json({ invoice });
    }
    if (action === 'delete') {
      if (!body.id) return Response.json({ error: 'Falta la factura' }, { status: 400 });
      await sr.entities.ProviderInvoice.delete(body.id);
      return Response.json({ ok: true });
    }
    if (action === 'markPaid') {
      if (!isFullAdmin(user)) return Response.json({ error: 'Solo el administrador' }, { status: 403 });
      const patch: any = { status: body.paid === false ? 'pendiente' : 'pagada' };
      if (body.payment_proof_url) patch.payment_proof_url = body.payment_proof_url;
      if (patch.status === 'pagada') { patch.paid_date = new Date().toISOString(); patch.paid_by = user.email; }
      const invoice = await sr.entities.ProviderInvoice.update(body.id, patch);
      return Response.json({ invoice });
    }
    if (action === 'listInstallments') {
      if (!isFullAdmin(user)) return Response.json({ error: 'Solo el administrador' }, { status: 403 });
      const inv = await sr.entities.ProviderInvoice.get(body.id);
      if (!inv) return Response.json({ error: 'Factura no encontrada' }, { status: 404 });
      const rows = await installmentsFor(sr, [body.id]);
      return Response.json({ invoice: withBalance(inv, rows) });
    }
    if (action === 'addInstallment') {
      if (!isFullAdmin(user)) return Response.json({ error: 'Solo el administrador' }, { status: 403 });
      const amount = round(Number(body.amount));
      if (!body.id || !(amount > 0)) return Response.json({ error: 'Indica un monto válido' }, { status: 400 });
      if (!body.proof_url) return Response.json({ error: 'Falta el comprobante del abono' }, { status: 400 });
      const inv = await sr.entities.ProviderInvoice.get(body.id);
      if (!inv) return Response.json({ error: 'Factura no encontrada' }, { status: 404 });
      if (inv.status === 'pagada') return Response.json({ error: 'La factura ya está pagada' }, { status: 400 });
      const before = sumOf(await installmentsFor(sr, [body.id]));
      const total = Number(inv.total) || 0;
      const balance = round(total - before);
      if (amount > balance + EPS) return Response.json({ error: `El abono supera el saldo pendiente (${balance.toFixed(2)})` }, { status: 400 });
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.payment_date || '')) ? body.payment_date : new Date().toISOString().slice(0, 10);
      await sr.entities.ProviderInvoiceInstallment.create({
        invoice_id: body.id, amount, payment_date: date, proof_url: String(body.proof_url),
        registered_by: user.email, registered_by_name: user.full_name || '',
      });
      if (round(before + amount) >= total - EPS) {
        await sr.entities.ProviderInvoice.update(body.id, {
          status: 'pagada', payment_proof_url: String(body.proof_url), paid_date: `${date}T12:00:00.000Z`, paid_by: user.email,
        });
      }
      const fresh = await sr.entities.ProviderInvoice.get(body.id);
      return Response.json({ invoice: withBalance(fresh, await installmentsFor(sr, [body.id])) });
    }
    if (action === 'deleteInstallment') {
      if (!isFullAdmin(user)) return Response.json({ error: 'Solo el administrador' }, { status: 403 });
      const row = await sr.entities.ProviderInvoiceInstallment.get(body.installment_id);
      if (!row) return Response.json({ error: 'Abono no encontrado' }, { status: 404 });
      const inv = await sr.entities.ProviderInvoice.get(row.invoice_id);
      const before = sumOf(await installmentsFor(sr, [row.invoice_id]));
      await sr.entities.ProviderInvoiceInstallment.delete(row.id);
      const after = round(before - (Number(row.amount) || 0));
      // Si el abono era el que completaba el pago, la factura vuelve a quedar pendiente.
      if (inv?.status === 'pagada' && before >= (Number(inv.total) || 0) - EPS && after < (Number(inv.total) || 0) - EPS) {
        await sr.entities.ProviderInvoice.update(inv.id, { status: 'pendiente' });
      }
      const fresh = await sr.entities.ProviderInvoice.get(row.invoice_id);
      return Response.json({ invoice: withBalance(fresh, await installmentsFor(sr, [row.invoice_id])) });
    }
    if (action === 'markPaidBulk') {
      if (!isFullAdmin(user)) return Response.json({ error: 'Solo el administrador' }, { status: 403 });
      const list = Array.isArray(body.items) ? body.items : [];
      if (!list.length) return Response.json({ error: 'No hay facturas seleccionadas' }, { status: 400 });
      if (list.some((i: any) => !i.id || !i.payment_proof_url)) return Response.json({ error: 'Falta el comprobante de alguna factura' }, { status: 400 });
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.paid_date || '')) ? `${body.paid_date}T12:00:00.000Z` : new Date().toISOString();
      await sr.entities.ProviderInvoice.bulkUpdate(list.map((i: any) => ({
        id: i.id, status: 'pagada', payment_proof_url: i.payment_proof_url, paid_date: date, paid_by: user.email,
      })));
      return Response.json({ ok: true, count: list.length });
    }
    return Response.json({ error: 'Acción inválida' }, { status: 400 });
  } catch (error: any) {
    const status = error instanceof BunnyUploadError ? error.status : 500;
    return Response.json({ error: error.message }, { status });
  }
});