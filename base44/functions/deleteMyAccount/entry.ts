import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    if (payload?.confirmation !== 'ELIMINAR') {
      return Response.json({ error: 'Confirmation required' }, { status: 400 });
    }

    await base44.asServiceRole.entities.User.delete(user.id);

    return Response.json({ success: true });
  } catch (error) {
    console.error('deleteMyAccount error:', error);
    if (String(error?.message || '').includes('owner of the app')) {
      return Response.json({ error: 'La cuenta propietaria de la app no puede eliminarse desde la aplicación.' }, { status: 403 });
    }
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
});