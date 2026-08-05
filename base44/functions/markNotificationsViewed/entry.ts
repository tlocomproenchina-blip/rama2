import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const types = Array.isArray(body?.notification_types)
      ? body.notification_types.filter((t) => typeof t === 'string' && t.length > 0)
      : [];
    if (!types.length) {
      return Response.json({ error: 'notification_types is required' }, { status: 400 });
    }

    // Marcar como leídas todas las notificaciones no leídas del usuario de los tipos indicados
    const result = await base44.entities.Notification.updateMany(
      { user_email: user.email, read: { $ne: true }, type: { $in: types } },
      { $set: { read: true } }
    );

    return Response.json({ success: true, types, updated: result });
  } catch (error) {
    return Response.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}