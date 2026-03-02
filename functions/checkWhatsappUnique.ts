import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function getDigits(str) {
  return (str || '').replace(/\D/g, '');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const whatsapp = body?.whatsapp || '';
    const currentUserId = body?.current_user_id || user.id;

    const digits = getDigits(whatsapp);
    if (!digits) {
      return Response.json({ error: 'Invalid WhatsApp number' }, { status: 400 });
    }

    // Busca usuarios que ya tengan este whatsapp_normalizado
    const matches = await base44.asServiceRole.entities.User.filter({ whatsapp_normalized: digits });

    const conflict = matches.find((u) => u.id !== currentUserId);

    if (conflict) {
      return Response.json({ unique: false, existing_user_email: conflict.email });
    }

    return Response.json({ unique: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Server error' }, { status: 500 });
  }
});