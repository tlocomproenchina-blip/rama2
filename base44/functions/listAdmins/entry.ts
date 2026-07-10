import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Usar service role para listar admins sin depender de permisos del usuario
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    const data = (admins || []).map(a => ({ email: a.email, full_name: a.full_name }));

    return Response.json({ admins: data });
  } catch (error) {
    return Response.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
});