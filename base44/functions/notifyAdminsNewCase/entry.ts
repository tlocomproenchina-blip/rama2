import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const ALLOWED_TYPES = ['payment_validation', 'assisted_payment'];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { title, message, type, reference_id, entity_type } = await req.json();
    if (!title || !message || !ALLOWED_TYPES.includes(type)) {
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    const emails = (admins || []).map((a) => a.email).filter(Boolean);
    if (emails.length === 0) return Response.json({ notified: 0 });

    await base44.asServiceRole.entities.Notification.bulkCreate(
      emails.map((email) => ({
        user_email: email,
        title,
        message,
        type,
        icon: 'dollar',
        priority: 'high',
        reference_id: reference_id || null,
        entity_type: entity_type || 'System',
        read: false,
      }))
    );

    return Response.json({ notified: emails.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}