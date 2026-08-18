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
    // Solo permitir editar si está en estado esperando_cliente
    if (quote.status === 'completado' || quote.status === 'enviado') {
      return Response.json({ error: 'Este presupuesto ya fue completado y no puede modificarse' }, { status: 403 });
    }

    const client_first_name = String(body.client_first_name || '').trim();
    const client_last_name = String(body.client_last_name || '').trim();
    const client_city = String(body.client_city || '').trim();
    const client_phone = String(body.client_phone || '').trim();
    const notes = String(body.notes || '').trim();
    const items = Array.isArray(body.items) ? body.items : [];

    if (!client_first_name || !client_last_name || !client_city || !client_phone) {
      return Response.json({ error: 'Todos los datos del cliente son obligatorios' }, { status: 400 });
    }

    const validItems = items.filter(it => it && (it.link || it.image_url));
    if (!validItems.length) {
      return Response.json({ error: 'Debes agregar al menos un producto con enlace o imagen' }, { status: 400 });
    }

    const cleanItems = validItems.map(it => ({
      link: String(it.link || ''),
      quantity: Number(it.quantity) || 1,
      image_url: String(it.image_url || ''),
      size: String(it.size || ''),
      unit_price: 0,
      currency: 'CNY',
      subtotal: 0,
      service_amount: 0,
      total: 0,
      total_usd: 0
    }));

    const updated = await base44.asServiceRole.entities.Quote.update(quote.id, {
      client_first_name,
      client_last_name,
      client_city,
      client_phone,
      notes,
      items: cleanItems,
      status: 'cliente_completo'
    });

    return Response.json({ quote: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}