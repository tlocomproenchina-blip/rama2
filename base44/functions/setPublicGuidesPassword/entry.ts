import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { passwordFields } from '../../shared/accessPassword.ts';

// Consulta (action: 'status') o define/quita la clave compartida del enlace público de guías. Solo admin.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e.status === 401 ? null : Promise.reject(e)));
    if (user?.role !== 'admin') return Response.json({ error: 'Solo el administrador' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole.entities.PublicGuidesAccess;
    const [current] = await svc.filter({ config_key: 'main' }, '-updated_date', 1);
    if (body.action === 'status') return Response.json({ access_password_set: !!current?.access_password_hash });
    const fields = { ...(await passwordFields(body.password)), updated_by: user.email };
    if (current) await svc.update(current.id, fields);
    else await svc.create({ config_key: 'main', ...fields });
    return Response.json({ access_password_set: !!fields.access_password_hash });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}