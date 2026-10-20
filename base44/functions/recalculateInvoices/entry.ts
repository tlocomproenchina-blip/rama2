// Recálculo de tarifas de todas las facturas.
//
// mode 'preview': devuelve, factura por factura, cómo queda el envío al cobrar
// cada recibo con su propia tarifa (general o alto riesgo/sensible), junto al
// tipo de carga resuelto de cada recibo. No escribe nada.
// mode 'apply': aplica los cambios de las facturas indicadas y deja rastro en
// la auditoría. Solo se aplican facturas con cambio real y sin bloqueo.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { fetchAllFilter, fetchByClientEmails, errorMessage } from '../../shared/paginatedFetch.ts';
import {
  buildRateContext, loadRateBase, loadClientStates, stateShippingRateFor,
} from '../../shared/billingRates.ts';
import { buildInvoiceRecalc } from '../../shared/invoiceRecalc.ts';

const CHUNK = 6;

export default async function (req: any) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const mode = body?.mode === 'apply' ? 'apply' : 'preview';
    const overrides = (body?.type_overrides && typeof body.type_overrides === 'object') ? body.type_overrides : {};
    const requestedIds = Array.isArray(body?.invoice_ids) ? body.invoice_ids.map(String).filter(Boolean) : null;

    const rateBase = await loadRateBase(base44);
    const all = await fetchAllFilter(base44.asServiceRole.entities.Invoice, {}, '-created_date');
    const scope = requestedIds && requestedIds.length
      ? all.filter((i: any) => requestedIds.includes(String(i.id)))
      : all;

    const emails = [...new Set(scope.map((i: any) => String(i.client_email || '').trim()).filter(Boolean))];
    const [states, receipts] = await Promise.all([
      loadClientStates(base44, emails),
      emails.length
        ? fetchByClientEmails(base44.asServiceRole.entities.CbmIngreso, emails, '-fecha')
        : Promise.resolve([]),
    ]);

    const byClient: Record<string, any[]> = {};
    for (const r of receipts || []) {
      const email = String(r.client_email || '').trim();
      if (!byClient[email]) byClient[email] = [];
      byClient[email].push(r);
    }

    const previews = scope.map((invoice: any) => {
      const email = String(invoice.client_email || '').trim();
      const ctx = buildRateContext({
        appConfig: rateBase.appConfig,
        pricing: rateBase.pricing,
        rateHistory: rateBase.rateHistory,
        stateShippingRate: stateShippingRateFor(rateBase, states[email]),
      });
      const sim = buildInvoiceRecalc({
        invoice,
        receiptsOfClient: byClient[email] || [],
        ctx,
        overrides,
      });
      return {
        invoice_number: invoice.invoice_number || '',
        client_email: email,
        status: invoice.status || '',
        paid: invoice.status === 'pagada',
        invoice_date: invoice.invoice_date || null,
        ...sim,
      };
    });

    if (mode === 'preview') {
      return Response.json({ mode, invoices: previews });
    }

    const targets = previews.filter((p: any) => p.changed && !p.blocked && !!p.updates);
    const applied: any[] = [];
    const skipped: any[] = [];

    for (let i = 0; i < targets.length; i += CHUNK) {
      const batch = targets.slice(i, i + CHUNK);
      const results = await Promise.allSettled(batch.map(async (p: any) => {
        await base44.asServiceRole.entities.Invoice.update(p.invoice_id, p.updates);
        await base44.asServiceRole.entities.ActivityAuditLog.create({
          entity_name: 'Invoice',
          entity_id: p.invoice_id,
          entity_label: `Factura ${p.invoice_number}`,
          action_type: 'update',
          action_detail: `Recálculo de tarifas por tipo de carga de cada recibo: envío $${Number(p.before.shipping || 0).toFixed(2)} → $${Number(p.after.shipping || 0).toFixed(2)}; total $${Number(p.before.total || 0).toFixed(2)} → $${Number(p.after.total || 0).toFixed(2)}.`,
          actor_email: user.email,
          actor_name: user.full_name || '',
          actor_role: user.role || 'admin',
          module_name: 'Facturas',
          page_path: '/AdminInvoices',
          summary: `Tarifas recalculadas: ${p.invoice_number}`,
          changed_fields: [
            { field_name: 'shipping_total', old_value: String(p.before.shipping), new_value: String(p.after.shipping) },
            { field_name: 'total', old_value: String(p.before.total), new_value: String(p.after.total) },
          ],
          client_side_timestamp: new Date().toISOString(),
        }).catch(() => null);
        return p;
      }));

      results.forEach((res: any, idx: number) => {
        const p = batch[idx];
        if (res.status === 'fulfilled') {
          applied.push({
            invoice_number: p.invoice_number,
            total_before: p.before.total,
            total_after: p.after.total,
          });
        } else {
          skipped.push({ invoice_number: p.invoice_number, reason: errorMessage(res.reason) });
        }
      });
    }

    return Response.json({
      mode,
      applied,
      skipped,
      total_before: applied.reduce((s: number, a: any) => s + Number(a.total_before || 0), 0),
      total_after: applied.reduce((s: number, a: any) => s + Number(a.total_after || 0), 0),
    });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}