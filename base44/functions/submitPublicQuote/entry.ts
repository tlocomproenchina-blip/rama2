import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendBrevoEmail } from '../../shared/brevoEmail.ts';

async function notifyAdminsOfQuoteSubmission(base44: any, quote: any) {
  try {
    // Verificar kill-switch global de emails
    let emailsEnabled = true;
    try {
      const configs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
      if (configs?.[0]?.emails_enabled === false) emailsEnabled = false;
    } catch {}

    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    const adminEmails = (admins || []).map((a: any) => a.email).filter(Boolean);
    if (adminEmails.length === 0) return;

    const title = '📋 Nuevo presupuesto completado por cliente';
    const message = `El cliente ${quote.client_first_name} ${quote.client_last_name} completó sus datos para el presupuesto ${quote.quote_number || quote.token.slice(0, 8)}. Revisa y asigna precios.`;

    // Notificación in-app para cada admin
    await base44.asServiceRole.entities.Notification.bulkCreate(
      adminEmails.map((email: string) => ({
        user_email: email,
        title,
        message,
        type: 'system',
        icon: 'bell',
        priority: 'medium',
        reference_id: quote.id,
        entity_type: 'System',
        read: false,
      }))
    );

    // Email a cada admin
    if (emailsEnabled) {
      const appName = 'TLEC CARGO';
      const body = `<h2>📋 Nuevo presupuesto completado por cliente</h2>
<p>Hola,</p>
<p>El cliente <strong>${quote.client_first_name} ${quote.client_last_name}</strong> ha completado sus datos para el presupuesto <strong>${quote.quote_number || quote.token.slice(0, 8)}</strong>.</p>
<p>Revisa y asigna precios en el panel de administración.</p>
<p style="margin-top:16px;color:#666;font-size:12px;">${appName}</p>`;
      await Promise.all(
        adminEmails.map((email: string) =>
          sendBrevoEmail(base44, { to: email, subject: title, body, from_name: appName, source: 'quote_submission' }).catch(() => {})
        )
      );
    }
  } catch (_) {}
}

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

    // Solo notificar a admins la PRIMERA vez que el cliente completa sus datos
    // (transición esperando_cliente → cliente_completo). Re-guardados en cliente_completo
    // no generan notificaciones ni emails duplicados.
    const wasWaiting = quote.status === 'esperando_cliente';

    const client_first_name = String(body.client_first_name || '').trim();
    const client_last_name = String(body.client_last_name || '').trim();
    const client_email = String(body.client_email || '').trim();
    const client_city = String(body.client_city || '').trim();
    const client_phone = String(body.client_phone || '').trim();
    const notes = String(body.notes || '').trim();
    const items = Array.isArray(body.items) ? body.items : [];

    if (!client_first_name || !client_last_name || !client_city || !client_phone) {
      return Response.json({ error: 'Todos los datos del cliente son obligatorios' }, { status: 400 });
    }

    // Buscar shipping mark si se proporcionó email
    let shipping_mark = '';
    if (client_email && client_email.includes('@')) {
      try {
        const users = await base44.asServiceRole.entities.User.filter({ email: client_email }, '-created_date', 1);
        if (users.length && users[0].shipping_mark) {
          shipping_mark = users[0].shipping_mark;
        }
      } catch {}
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

    const updateData = {
      client_first_name,
      client_last_name,
      client_city,
      client_phone,
      notes,
      items: cleanItems,
      status: 'cliente_completo'
    };
    if (client_email) updateData.client_email = client_email;
    if (shipping_mark) updateData.shipping_mark = shipping_mark;

    const updated = await base44.asServiceRole.entities.Quote.update(quote.id, updateData);

    // Notificar a administradores que el cliente completó sus datos (solo la primera vez)
    if (wasWaiting) {
      await notifyAdminsOfQuoteSubmission(base44, updated);
    }

    return Response.json({ quote: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}