import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { applyCreditsToUnpaidInvoices } from '../../shared/clientCredit.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { invoice_id, client_email } = body || {};

    let targetEmail = client_email;

    if (invoice_id) {
      const invoice = await base44.asServiceRole.entities.Invoice.get(invoice_id);
      if (!invoice) return Response.json({ error: 'Factura no encontrada' }, { status: 404 });
      if (invoice.status === 'pagada' || invoice.status === 'cancelada') {
        return Response.json({ success: true, message: 'Factura no pendiente', applied: [] });
      }
      targetEmail = invoice.client_email;
    }

    if (!targetEmail) {
      return Response.json({ error: 'invoice_id o client_email requerido' }, { status: 400 });
    }

    const result = await applyCreditsToUnpaidInvoices(base44, targetEmail);

    return Response.json({
      success: true,
      remaining_balance: result.balance,
      applied: result.applied
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}