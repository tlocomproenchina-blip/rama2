import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const [packageRows, routeRows, userRows] = await Promise.all([
      base44.asServiceRole.entities.Package.list('-updated_date', 300),
      base44.asServiceRole.entities.Ruta.list('-updated_date', 200),
      base44.asServiceRole.entities.User.list('-created_date', 500),
    ]);

    const usersMap = new Map((userRows || []).map((item) => [String(item.email || '').toLowerCase(), item]));

    const packages = (packageRows || []).map((item) => {
      const client = usersMap.get(String(item.client_email || '').toLowerCase());
      const clientName = client?.full_name || `${client?.first_name || ''} ${client?.last_name || ''}`.trim() || item.client_email || 'Sin cliente';
      const clientPhone = client?.whatsapp || client?.telefono || client?.phone || '';
      const tracking = item.tracking_number || item.id;
      const shippingMark = item.shipping_mark || '';
      return {
        id: item.id,
        label: `${tracking}${shippingMark ? ` · ${shippingMark}` : ''}${clientName ? ` · ${clientName}` : ''}`,
        searchText: [tracking, shippingMark, clientName, item.client_email, clientPhone].filter(Boolean).join(' '),
      };
    });

    const routes = (routeRows || []).map((item) => ({
      id: item.id,
      label: item.codigo_ruta || item.nombre || item.id,
      searchText: [item.codigo_ruta, item.nombre, item.id].filter(Boolean).join(' '),
    }));

    return Response.json({ packages, routes });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});