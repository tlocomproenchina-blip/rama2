import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { fetchAllFilter } from '../../shared/paginatedFetch.ts';
import {
  loadRateBase, loadClientStates, stateShippingRateFor, buildRateContext,
} from '../../shared/billingRates.ts';
import {
  detectGroups, buildPlan, loadInvoicesById, groupPreview, applyMerge,
} from '../../shared/duplicateReceipts.ts';

// Fusión de recibos duplicados de contabilidad (Ingresos de CBM).
//
// mode: 'scan'  → detecta los recibos del mismo cliente con el mismo N° de orden
//                 y devuelve, por grupo, qué recibo sobrevive, el CBM resultante
//                 y cómo cambia cada factura afectada. No modifica nada.
// mode: 'merge' → ejecuta la fusión de los grupos indicados (CBM y paquetes
//                 sumados, trackings unidos, duplicados eliminados, facturas
//                 recalculadas y rastro en la auditoría de actividad).
//
// Solo administradores.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const mode = body.mode === 'merge' ? 'merge' : 'scan';

    // ---------- Escaneo: solo lectura ----------
    if (mode === 'scan') {
      const clientEmail = String(body.client_email || '').trim();
      const receipts = await fetchAllFilter(
        base44.asServiceRole.entities.CbmIngreso,
        clientEmail ? { client_email: clientEmail } : {},
        '-fecha'
      );

      const found = detectGroups(receipts);
      if (!found.length) {
        return Response.json({
          ok: true, mode, scanned: receipts.length,
          groups: [], exact_groups: 0, possible_groups: 0,
        });
      }

      const invoiceIds = [...new Set(found.flatMap((g) => g.list.map((r: any) => r.billed_invoice_id)).filter(Boolean))];
      const invoicesById = await loadInvoicesById(base44, invoiceIds as string[]);
      const existingInvoiceIds = new Set(Object.keys(invoicesById));

      const emails = [...new Set(found.map((g) => String(g.list[0]?.client_email || '')).filter(Boolean))];
      const rateBase = await loadRateBase(base44);
      const states = await loadClientStates(base44, emails);

      const groups = found.map((group) => {
        const plan = buildPlan(group.list, existingInvoiceIds);
        if (!plan) return null;
        const email = String(plan.keep.client_email || '');
        const ctx = buildRateContext({
          appConfig: rateBase.appConfig,
          pricing: rateBase.pricing,
          rateHistory: rateBase.rateHistory,
          stateShippingRate: stateShippingRateFor(rateBase, states[email]),
        });
        return groupPreview({
          group, plan, invoicesById,
          receiptsOfClient: receipts,
          ctx,
          clientName: plan.keep.client_name,
        });
      }).filter(Boolean);

      return Response.json({
        ok: true,
        mode,
        scanned: receipts.length,
        groups,
        exact_groups: groups.filter((g: any) => g.same_cbm).length,
        possible_groups: groups.filter((g: any) => !g.same_cbm).length,
      });
    }

    // ---------- Fusión ----------
    const requested = Array.isArray(body.groups) ? body.groups : [];
    if (!requested.length) {
      return Response.json({ error: 'No se indicaron grupos para fusionar' }, { status: 400 });
    }

    const allIds = [...new Set(requested.flatMap((g: any) => Array.isArray(g.ids) ? g.ids : []).filter(Boolean))];
    if (!allIds.length) return Response.json({ error: 'No se indicaron recibos' }, { status: 400 });

    const loaded = await fetchAllFilter(
      base44.asServiceRole.entities.CbmIngreso, { id: { $in: allIds } }, '-fecha'
    );
    const byId: Record<string, any> = {};
    for (const r of loaded || []) byId[r.id] = r;

    const rateBase = await loadRateBase(base44);
    const emails = [...new Set(Object.values(byId).map((r: any) => String(r.client_email || '')).filter(Boolean))];
    const states = await loadClientStates(base44, emails);
    const ctxCache: Record<string, any> = {};
    const ctxFor = (email: string) => {
      if (!ctxCache[email]) {
        ctxCache[email] = buildRateContext({
          appConfig: rateBase.appConfig,
          pricing: rateBase.pricing,
          rateHistory: rateBase.rateHistory,
          stateShippingRate: stateShippingRateFor(rateBase, states[email]),
        });
      }
      return ctxCache[email];
    };

    const merged: any[] = [];
    const skipped: any[] = [];

    for (const group of requested) {
      const ids = (Array.isArray(group.ids) ? group.ids : []).filter(Boolean);
      const list = ids.map((id: string) => byId[id]).filter(Boolean);
      if (list.length < 2) {
        skipped.push({ order: String(group.order || ''), reason: 'Los recibos ya no están disponibles' });
        continue;
      }

      const invoiceIds = [...new Set(list.map((r: any) => r.billed_invoice_id).filter(Boolean))];
      const invoicesById = await loadInvoicesById(base44, invoiceIds as string[]);
      const plan = buildPlan(list, new Set(Object.keys(invoicesById)), group.keep_id);
      if (!plan) {
        skipped.push({ order: String(group.order || ''), reason: 'No se pudo armar el grupo' });
        continue;
      }
      if (group.keep_id && String(plan.keep.id) !== String(group.keep_id)) {
        skipped.push({ order: plan.order, reason: 'El recibo a conservar ya no existe' });
        continue;
      }

      const result = await applyMerge(base44, plan, ctxFor(String(plan.keep.client_email || '')), user);
      merged.push(result);
    }

    return Response.json({
      ok: true,
      mode,
      merged,
      skipped,
      summary: {
        merged_groups: merged.length,
        merged_receipts: merged.reduce((s, m) => s + (m.absorbed_ids?.length || 0), 0),
        invoices_updated: merged.reduce((s, m) => s + (m.invoices?.length || 0), 0),
        skipped_groups: skipped.length,
      },
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Error al fusionar los recibos' }, { status: 500 });
  }
}