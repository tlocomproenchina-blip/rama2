import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { passwordFields } from '../../shared/accessPassword.ts';

// Define o quita la contraseña de ingreso del enlace público de un presupuesto (solo admin).
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e.status === 401 ? null : Promise.reject(e)));
    if (user?.role !== 'admin') return Response.json({ error: 'Solo el administrador' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    if (!body.quote_id) return Response.json({ error: 'Falta el presupuesto' }, { status: 400 });
    const quote = await base44.asServiceRole.entities.Quote.get(body.quote_id).catch((e: any) => (e.status === 404 ? null : Promise.reject(e)));
    if (!quote) return Response.json({ error: 'Presupuesto no encontrado' }, { status: 404 });
    const fields = await passwordFields(body.password);
    const updated = await base44.asServiceRole.entities.Quote.update(quote.id, fields);
    return Response.json({ quote: updated, access_password_set: !!fields.access_password_hash });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}