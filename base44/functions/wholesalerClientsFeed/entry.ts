import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { connectionLabel, resolveConnectionForKey } from '../../shared/wholesalerCore.ts';

// Lado mayorista de la integración: entrega la lista de clientes de esta app a la
// app que la consulta. Admite ?since=fecha (ISO) para devolver solo los clientes
// aparecidos después de ese corte y no repetir los ya entregados. La clave que
// presenta identifica con qué mayorista se está hablando.
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const connection = await resolveConnectionForKey(base44, req.headers.get('x-api-key') || '');
    if (!connection) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const since = (url.searchParams.get('since') || '').trim();
    const asked = Number(url.searchParams.get('limit'));
    const limit = Math.min(Math.max(Number.isFinite(asked) && asked > 0 ? asked : DEFAULT_LIMIT, 1), MAX_LIMIT);

    const query: Record<string, any> = { role: 'user' };
    if (since) query.created_date = { $gt: since };

    const users = await base44.asServiceRole.entities.User.filter(query, 'created_date', limit);

    const clients = (users || [])
      .map((u: any) => ({
        external_id: u.id,
        email: String(u.email || '').toLowerCase(),
        first_name: u.first_name || '',
        last_name: u.last_name || '',
        full_name: u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim(),
        cedula: u.cedula || '',
        whatsapp: u.whatsapp || '',
        city: u.city || '',
        state: u.state || '',
        address: u.address || '',
        shipping_mark: u.shipping_mark || '',
      }))
      .filter((c: any) => c.email);

    return Response.json({
      ok: true,
      mayorista: connectionLabel(connection),
      since: since || null,
      total: clients.length,
      clients,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}