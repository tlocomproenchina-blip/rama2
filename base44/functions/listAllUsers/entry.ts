import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { sanitizeUser, userMatchesSearch } from '../../shared/userSanitize.ts';

// Lista TODOS los usuarios (admins + clientes) con datos sanitizados.
// Usa asServiceRole para evitar errores de permiso en el frontend.
//
// Parámetros (body JSON):
//   q: string        — búsqueda difusa (email, nombre, shipping_mark, whatsapp, ciudad)
//   role: string     — 'admin' | 'user' | undefined (todos)
//   emails: string[] — filtrar por lista de emails exactos (fast path con $in)
//   limit, skip      — paginación
//   includeAdmins: bool — si false, excluye admins (default true)

const CACHE_TTL_MS = 60 * 1000;
let _cache = { at: 0, all: null };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowed = user.role === 'admin' || user.custom_role === 'customer_service';
    if (!allowed) {
      return Response.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const q = (body.q || '').toString().trim();
    const roleFilter = body.role || ''; // 'admin' | 'user' | ''
    const emails: string[] = Array.isArray(body.emails) ? body.emails.filter(Boolean) : [];
    const includeAdmins = body.includeAdmins !== false;
    const limit = Math.min(Math.max(parseInt(body.limit) || 1000, 1), 5000);
    const skip = Math.max(parseInt(body.skip) || 0, 0);
    const forceRefresh = body.forceRefresh === true;

    // FAST PATH: emails específicos → consulta directa con $in
    if (emails.length > 0) {
      const users = await base44.asServiceRole.entities.User.filter(
        { email: { $in: emails } }, '-created_date', emails.length + 10
      );
      let result = (users || []).filter((u) => u && u.email && u.custom_role !== 'super_admin_oculto').map(sanitizeUser);
      if (!includeAdmins) result = result.filter((u) => u.role !== 'admin');
      if (roleFilter) result = result.filter((u) => u.role === roleFilter);
      return Response.json({ users: result, total: result.length });
    }

    // Cargar todo con caché TTL
    const now = Date.now();
    const cacheValid = !forceRefresh && _cache.all && (now - _cache.at) < CACHE_TTL_MS;

    let all;
    if (cacheValid) {
      all = _cache.all;
    } else {
      all = [];
      let s = 0;
      const PAGE = 200;
      while (true) {
        const batch = await base44.asServiceRole.entities.User.list('-created_date', PAGE, s);
        if (!batch || batch.length === 0) break;
        all = all.concat(batch);
        if (batch.length < PAGE) break;
        s += PAGE;
        if (s >= 10000) break; // safety guard
      }
      all = all.filter((u) => u && u.id && u.email && u.custom_role !== 'super_admin_oculto').map(sanitizeUser);
      _cache = { at: now, all };
    }

    let filtered = all;
    if (!includeAdmins) filtered = filtered.filter((u) => u.role !== 'admin');
    if (roleFilter) filtered = filtered.filter((u) => u.role === roleFilter);
    if (q) filtered = filtered.filter((u) => userMatchesSearch(u, q));

    const total = filtered.length;
    const page = filtered.slice(skip, skip + limit);

    return Response.json({ users: page, total, skip, limit });
  } catch (error) {
    console.error('listAllUsers error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});