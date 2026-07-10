import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Crea notificaciones in-app para todos los administradores sin exponer sus emails al frontend.

const VALID_TYPES = ['package', 'consolidation', 'request', 'system'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];
const VALID_ICONS = ['package', 'truck', 'check', 'alert', 'dollar', 'bell', 'info'];
const VALID_ENTITY_TYPES = ['Package', 'Consolidation', 'ConsolidationRequest', 'System'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const { title, message, type, icon, reference_id, entity_type, priority } = payload || {};

    if (!title && !message) {
      return Response.json({ error: 'title or message required' }, { status: 400 });
    }

    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });

    await Promise.all(
      (admins || []).map((a) =>
        base44.asServiceRole.entities.Notification.create({
          user_email: a.email,
          title: String(title || message).slice(0, 200),
          message: String(message || title).slice(0, 2000),
          type: VALID_TYPES.includes(type) ? type : 'system',
          priority: VALID_PRIORITIES.includes(priority) ? priority : 'medium',
          reference_id: reference_id ? String(reference_id) : null,
          entity_type: VALID_ENTITY_TYPES.includes(entity_type) ? entity_type : 'System',
          icon: VALID_ICONS.includes(icon) ? icon : 'bell',
          read: false,
        })
      )
    );

    return Response.json({ success: true, notified: (admins || []).length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});