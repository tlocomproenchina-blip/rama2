import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Devuelve un mapa { client_email: count } con el conteo total de paquetes por cliente.
// Usa service role para ignorar el límite de 500 por consulta y traer todo paginando.
// Solo admins pueden invocarlo.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sb = base44.asServiceRole;
    const counts = {};
    const PAGE = 1000;
    let skip = 0;
    let total = 0;

    // Paginar hasta agotar
    while (true) {
      const batch = await sb.entities.Package.list('-created_date', PAGE, skip);
      if (!batch || batch.length === 0) break;
      for (const p of batch) {
        if (p?.client_email) {
          counts[p.client_email] = (counts[p.client_email] || 0) + 1;
        }
      }
      total += batch.length;
      if (batch.length < PAGE) break;
      skip += PAGE;
      // Hard cap de seguridad
      if (skip > 50000) break;
    }

    return Response.json({ success: true, counts, total });
  } catch (error) {
    console.error('getClientPackageCounts error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});