import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';

// Cruce por contenedor: factura de proveedor ↔ facturas del cliente.
const norm = (s: any) => String(s || '').replace(/\s+/g, '').toUpperCase();
// Coincidencia exacta del contenedor como palabra (evita que "377" coincida con "1377").
const hasToken = (text: any, code: string) =>
  String(text || '').toUpperCase().split(/[^A-Z0-9-]+/).some((t) => t === code);
const round = (n: number) => Math.round(n * 100) / 100;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'No autorizado' }, { status: 403 });
    const sr = base44.asServiceRole;

    const pis = await sr.entities.ProviderInvoice.list('-created_date', 5000);
    const ids = pis.map((p: any) => p.id);
    const inst = ids.length ? await sr.entities.ProviderInvoiceInstallment.filter({ invoice_id: { $in: ids } }, 'created_date', 10000) : [];
    const emails = [...new Set(pis.map((p: any) => String(p.client_email || '').toLowerCase()).filter(Boolean))];
    const invs = emails.length ? await sr.entities.Invoice.filter({ client_email: { $in: emails } }, '-created_date', 10000) : [];

    // Cuántas facturas de proveedor comparten contenedor (desglose explícito)
    const perCode: Record<string, number> = {};
    pis.forEach((p: any) => { const c = norm(p.invoice_code); perCode[c] = (perCode[c] || 0) + 1; });

    const rows = pis.map((p: any) => {
      const code = norm(p.invoice_code);
      const email = String(p.client_email || '').toLowerCase();
      const payments = inst.filter((i: any) => i.invoice_id === p.id)
        .map((i: any) => ({ amount: Number(i.amount || 0), date: i.payment_date || i.created_date, proof_url: i.proof_url }));
      const total = Number(p.total || 0);
      let paid = payments.reduce((s: number, i: any) => s + i.amount, 0);
      if (p.status === 'pagada') {
        if (!payments.length && p.payment_proof_url) payments.push({ amount: round(total - paid), date: p.paid_date, proof_url: p.payment_proof_url });
        paid = total;
      }
      const matched = code ? invs.filter((inv: any) => String(inv.client_email || '').toLowerCase() === email && (
        hasToken(inv.consolidation_tracking, code) ||
        (inv.items || []).some((it: any) => hasToken(it.description, code))
      )) : [];
      return {
        id: p.id,
        container: p.invoice_code,
        client_email: p.client_email,
        client_name: p.client_name,
        shipping_mark: p.shipping_mark,
        load_date: p.load_date,
        cbm: p.cbm,
        total: round(total),
        paid: round(paid),
        balance: round(Math.max(0, total - paid)),
        status: p.status,
        invoice_file_url: p.invoice_file_url || null,
        payments,
        shared_container: perCode[code] > 1 ? perCode[code] : 0,
        client_invoices: matched.map((i: any) => ({ id: i.id, invoice_number: i.invoice_number, total: i.total, status: i.status })),
      };
    });
    return Response.json({ rows });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
});