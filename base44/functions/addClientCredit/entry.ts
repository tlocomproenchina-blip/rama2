import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { applyCreditsToUnpaidInvoices, getClientCreditBalance } from '../../shared/clientCredit.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { client_email, amount, description, type, reference } = body || {};

    if (!client_email || !amount || Number(amount) <= 0) {
      return Response.json({ error: 'client_email y amount (>0) son obligatorios' }, { status: 400 });
    }

    // Crear movimiento de crédito
    await base44.asServiceRole.entities.ClientCredit.create({
      client_email,
      amount: Number(amount),
      type: type || 'credito',
      description: description || 'Crédito manual',
      reference: reference || '',
      created_by_email: user.email
    });

    // Aplicar automáticamente a facturas impagas
    const result = await applyCreditsToUnpaidInvoices(base44, client_email);

    return Response.json({
      success: true,
      remaining_balance: result.balance,
      applied: result.applied
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}