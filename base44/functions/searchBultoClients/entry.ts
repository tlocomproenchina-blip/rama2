import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { searchClientsByQuery } from '../../shared/bultoScan.ts';

// Búsqueda parcial case-insensitive de clientes (Users) por shipping_mark, email, full_name y cedula.
// Retorna top 10 sugerencias para el dropdown del buscador universal de WarehouseBultos.
// Recibe: { query: string }
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    // Misma búsqueda que usa el escaneo de bultos sin sesión (lógica compartida).
    const clients = await searchClientsByQuery(base44, body.query);

    return Response.json({ clients });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}