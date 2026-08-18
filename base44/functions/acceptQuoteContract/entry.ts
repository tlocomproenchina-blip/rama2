import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const token = String(body.token || '').trim();
    if (!token) return Response.json({ error: 'Token requerido' }, { status: 400 });

    const quotes = await base44.asServiceRole.entities.Quote.filter({ token }, '-created_date', 1);
    if (!quotes.length) return Response.json({ error: 'Presupuesto no encontrado' }, { status: 404 });

    const quote = quotes[0];
    if (quote.contract_accepted) {
      return Response.json({ error: 'El contrato ya fue aceptado' }, { status: 400 });
    }

    const updated = await base44.asServiceRole.entities.Quote.update(quote.id, {
      contract_accepted: true,
      contract_accepted_date: new Date().toISOString()
    });

    return Response.json({ quote: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}