import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { approveInsurancePaymentRecord, errorMessage, approvalErrorStatus } from '../../shared/paymentApproval.ts';

// Aprobación individual de un pago de seguro. La lógica vive en shared/paymentApproval.ts
// y es la misma que usa la aprobación masiva (bulkApprovePayments).
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    let payload: any = {};
    try { payload = await req.json(); } catch (_) { payload = {}; }
    const paymentId = payload?.payment_id;
    if (!paymentId) {
      return Response.json({ error: 'Missing payment_id' }, { status: 400 });
    }

    const result = await approveInsurancePaymentRecord(base44, String(paymentId), user.email);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: approvalErrorStatus(error) });
  }
}