// Restablece y protege las facturas cuyo envío fue reducido por el recálculo de
// tarifas y que tienen el monto anterior documentado en su propio historial.
//
//   mode 'preview' → no escribe nada: devuelve, factura por factura, el total
//                    actual, el que quedaría y por qué se omite la que no aplica.
//   mode 'apply'   → restablece el envío, marca la factura como protegida y deja
//                    el rastro en la auditoría de actividad.
//
// No modifica pagos, estado ni costo del proveedor: solo líneas de envío,
// subtotal, total y desglose de envío.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { fetchAllFilter, errorMessage } from '../../shared/paginatedFetch.ts';
import { planRestore, invoiceLocked } from '../../shared/invoiceLock.ts';

export default async function (req: any) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const mode = body?.mode === 'apply' ? 'apply' : 'preview';
    const requested = Array.isArray(body?.invoice_ids) ? body.invoice_ids.map(String).filter(Boolean) : null;

    const all = await fetchAllFilter(base44.asServiceRole.entities.Invoice, {}, '-created_date');
    const scope = requested && requested.length
      ? all.filter((inv: any) => requested.includes(String(inv.id)))
      : all;

    const plans = scope
      .map((invoice: any) => planRestore(invoice, user.email))
      .filter((p: any) => requested && requested.length ? true : p.skipped !== 'sin_registro');

    if (mode === 'preview') {
      return Response.json({
        mode,
        invoices: plans,
        restorable: plans.filter((p: any) => p.updates).length,
        locked_count: scope.filter(invoiceLocked).length,
      });
    }

    const targets = plans.filter((p: any) => p.updates && !p.skipped);
    const applied: any[] = [];
    const skipped: any[] = [];

    for (const plan of targets) {
      try {
        const invoice = scope.find((inv: any) => String(inv.id) === String(plan.invoice_id));
        await base44.asServiceRole.entities.Invoice.update(plan.invoice_id, {
          ...plan.updates,
          notes: [
            String(invoice?.notes || '').trim(),
            `Factura restablecida y protegida el ${new Date().toISOString().slice(0, 10)} por ${user.email}: envío $${Number(plan.before.shipping).toFixed(2)} → $${Number(plan.after.shipping).toFixed(2)}; total $${Number(plan.before.total).toFixed(2)} → $${Number(plan.after.total).toFixed(2)}.`,
          ].filter(Boolean).join('\n').slice(0, 1000),
        });

        await base44.asServiceRole.entities.ActivityAuditLog.create({
          entity_name: 'Invoice',
          entity_id: plan.invoice_id,
          entity_label: `Factura ${plan.invoice_number}`,
          action_type: 'update',
          action_detail: `Restauración y protección: envío $${Number(plan.before.shipping).toFixed(2)} → $${Number(plan.after.shipping).toFixed(2)}; total $${Number(plan.before.total).toFixed(2)} → $${Number(plan.after.total).toFixed(2)}. La factura queda protegida contra nuevas ediciones.`,
          actor_email: user.email,
          actor_name: user.full_name || '',
          actor_role: user.role || 'admin',
          module_name: 'Facturas',
          page_path: '/AdminInvoices',
          summary: `Factura restablecida y protegida: ${plan.invoice_number}`,
          changed_fields: [
            { field_name: 'shipping_total', old_value: String(plan.before.shipping), new_value: String(plan.after.shipping) },
            { field_name: 'total', old_value: String(plan.before.total), new_value: String(plan.after.total) },
            { field_name: 'locked', old_value: 'false', new_value: 'true' },
          ],
          client_side_timestamp: new Date().toISOString(),
        }).catch(() => null);

        applied.push({
          invoice_number: plan.invoice_number,
          total_before: plan.before.total,
          total_after: plan.after.total,
        });
      } catch (error) {
        skipped.push({ invoice_number: plan.invoice_number, reason: errorMessage(error) });
      }
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