import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

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
    const query: string = (body.query || '').toString().trim().toLowerCase();
    if (!query || query.length < 2) {
      return Response.json({ clients: [] });
    }

    // Paginar todos los usuarios (el límite por llamada es 500) para no perder clientes antiguos
    const allUsers: any[] = [];
    let offset = 0;
    const pageSize = 500;
    const maxPages = 20; // hard cap: 10.000 usuarios
    for (let i = 0; i < maxPages; i++) {
      const page = await base44.asServiceRole.entities.User.list('-created_date', pageSize, offset);
      if (!page || page.length === 0) break;
      allUsers.push(...page);
      if (page.length < pageSize) break;
      offset += pageSize;
    }
    const matches = allUsers.filter((u: any) => {
      const sm = (u.shipping_mark || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const name = (u.full_name || '').toLowerCase();
      const cedula = (u.cedula || '').toLowerCase();
      return sm.includes(query) || email.includes(query) || name.includes(query) || cedula.includes(query);
    });

    const results = matches.slice(0, 10).map((u: any) => ({
      email: u.email || '',
      shipping_mark: u.shipping_mark || '',
      full_name: u.full_name || '',
      cedula: u.cedula || '',
      state: u.state || '',
      city: u.city || '',
    }));

    return Response.json({ clients: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}