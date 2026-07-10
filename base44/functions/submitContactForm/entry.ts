import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Formulario público de contacto: permite a visitantes (sin sesión) enviar consultas.
// Valida el contenido y notifica a los administradores (email + notificación in-app).

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));

    const name = String(payload?.name || '').trim().slice(0, 120);
    const email = String(payload?.email || '').trim().slice(0, 200);
    const message = String(payload?.message || '').trim().slice(0, 5000);

    if (!name || !email || !message) {
      return Response.json({ error: 'Todos los campos son obligatorios' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'Email inválido' }, { status: 400 });
    }

    const subject = `Nuevo mensaje de contacto: ${name}`;
    const body = `Nombre: ${name}\nEmail: ${email}\n\nMensaje:\n${message}`;

    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    if (!admins || admins.length === 0) {
      return Response.json({ error: 'No hay destinatarios disponibles' }, { status: 500 });
    }

    let notified = 0;
    for (const admin of admins) {
      // Notificación in-app (siempre)
      await base44.asServiceRole.entities.Notification.create({
        user_email: admin.email,
        title: subject,
        message: `${email}: ${message.slice(0, 500)}`,
        type: 'system',
        priority: 'medium',
        icon: 'info',
        read: false,
      });
      notified += 1;

      // Email (mejor esfuerzo — solo a usuarios registrados de la app)
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: admin.email,
          subject,
          body,
        });
      } catch (_) { /* no bloquear si el email falla */ }
    }

    return Response.json({ success: true, notified });
  } catch (error) {
    console.error('submitContactForm error:', error?.message || error);
    return Response.json({ error: 'No se pudo enviar el mensaje' }, { status: 500 });
  }
});