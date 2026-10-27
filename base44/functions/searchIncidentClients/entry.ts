import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { findIncidentClients } from '../../shared/incidentClientSearch.ts';

// Buscador único de clientes para las incidencias de almacén: encuentra al
// cliente por shipping mark, tracking, email, teléfono, nombre o cédula.
// Recibe: { query: string }
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const clients = await findIncidentClients(base44, body.query);

    return Response.json({ clients });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}