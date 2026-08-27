import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Registra una visita a una landing page de ciudad. Público (sin auth):
// el visitante no está logueado, por eso usamos asServiceRole.
export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const slug = String(body?.slug || '').trim().toLowerCase();
    const city = String(body?.city || '').trim();
    const state_name = String(body?.state_name || '').trim();

    if (!slug) {
      return Response.json({ ok: false, error: 'slug requerido' }, { status: 400 });
    }

    const existing = await base44.asServiceRole.entities.CityLandingStats.filter({ slug }, '-updated_date', 5);
    const now = new Date().toISOString();

    if (existing.length > 0) {
      const rec = existing[0];
      await base44.asServiceRole.entities.CityLandingStats.update(rec.id, {
        visit_count: (rec.visit_count || 0) + 1,
        last_visit_date: now
      });
    } else {
      await base44.asServiceRole.entities.CityLandingStats.create({
        slug,
        city,
        state_name,
        visit_count: 1,
        last_visit_date: now
      });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'error' }, { status: 500 });
  }
}