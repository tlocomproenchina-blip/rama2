import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { sanitizeUser } from '../../shared/userSanitize.ts';
import { isAreaEmployee } from '../../shared/roleAreas.ts';

// Lista cuentas con role='admin' con datos completos sanitizados.
// Usa asServiceRole para evitar permisos de User.list en el frontend.
// Acepta `q` opcional para filtrar por email, nombre, custom_role, ciudad.
// Acepta `kind` para separar los dos directorios:
//   'admins'    -> cuentas administradoras (sin área de empleado)
//   'employees' -> empleados con rol de área
//   'all' (por defecto) -> todas las cuentas administrativas

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowed = user.role === 'admin';
    if (!allowed) {
      return Response.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const q = (body.q || '').toString().trim();
    const limit = Math.min(Math.max(parseInt(body.limit) || 500, 1), 1000);
    const skip = Math.max(parseInt(body.skip) || 0, 0);

    // Paginar admins con asServiceRole
    let all = [];
    let s = 0;
    const PAGE = 200;
    while (true) {
      const batch = await base44.asServiceRole.entities.User.filter({ role: 'admin' }, '-created_date', PAGE, s);
      if (!batch || batch.length === 0) break;
      all = all.concat(batch);
      if (batch.length < PAGE) break;
      s += PAGE;
      if (s >= 3000) break; // safety guard
    }

    // Filtrar super_admin_oculto
    all = all.filter((u) => u && u.id && u.email && u.custom_role !== 'super_admin_oculto');

    // Cada cuenta cae en un solo directorio: empleado (con área) o administrador.
    const counts = { admins: 0, employees: 0 };
    all.forEach((u) => {
      if (isAreaEmployee(u)) counts.employees += 1;
      else counts.admins += 1;
    });

    const kind = ['admins', 'employees'].includes(String(body.kind)) ? String(body.kind) : 'all';
    const scoped = all.filter((u) => kind === 'all' || (kind === 'employees' ? isAreaEmployee(u) : !isAreaEmployee(u)));

    let sanitized = scoped.map(sanitizeUser);

    // Búsqueda opcional en memoria
    if (q) {
      const ql = q.toLowerCase();
      sanitized = sanitized.filter((u) => {
        const email = (u.email || '').toLowerCase();
        const fullName = (u.full_name || '').toLowerCase();
        const customRole = (u.custom_role || '').toLowerCase();
        const firstName = (u.first_name || '').toLowerCase();
        const lastName = (u.last_name || '').toLowerCase();
        const city = (u.city || '').toLowerCase();
        return email.includes(ql) || fullName.includes(ql) || customRole.includes(ql) ||
               firstName.includes(ql) || lastName.includes(ql) || city.includes(ql);
      });
    }

    const total = sanitized.length;
    const page = sanitized.slice(skip, skip + limit);

    return Response.json({ admins: page, total, counts, kind, skip, limit });
  } catch (error) {
    console.error('listAdmins error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});