import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { resolveConnectionForKey } from '../../shared/wholesalerCore.ts';

// Lado mayorista: la app del mayorista consulta con su clave las versiones
// publicadas para ella y reporta si las aplicó. Solo lectura de versiones y
// escritura de su propio estado: no toca ningún otro dato de esta app.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const connection = await resolveConnectionForKey(base44, req.headers.get('x-api-key') || '');
    if (!connection) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const key = connection.config_key || 'main';
    const db = base44.asServiceRole.entities;
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const action = body.action || 'latest';

    const statuses = await db.WholesalerReleaseStatus.filter({ wholesaler_key: key }, '-created_date', 50);

    if (action === 'report') {
      const row = statuses.find((s: any) => s.release_id === body.release_id);
      if (!row) return Response.json({ error: 'Versión no asignada a este mayorista' }, { status: 404 });
      const status = body.status === 'aplicada' ? 'aplicada' : body.status === 'fallida' ? 'fallida' : null;
      if (!status) return Response.json({ error: 'status debe ser aplicada o fallida' }, { status: 400 });
      await db.WholesalerReleaseStatus.update(row.id, {
        status,
        message: String(body.message || '').slice(0, 1000),
        reported_date: new Date().toISOString(),
      });
      return Response.json({ ok: true });
    }

    const releases = [];
    for (const s of statuses) {
      const r = await db.AppRelease.get(s.release_id).catch(() => null);
      if (!r || r.status !== 'publicada') continue;
      if (s.status === 'pendiente') {
        await db.WholesalerReleaseStatus.update(s.id, { status: 'recibida', received_date: new Date().toISOString() });
      }
      releases.push({
        release_id: r.id, version: r.version, title: r.title || '', notes: r.notes || '',
        repo_ref: r.repo_ref || '', scope: r.scope || [], published_date: r.published_date,
        status: s.status === 'pendiente' ? 'recibida' : s.status,
      });
    }
    return Response.json({ ok: true, latest: releases[0] || null, releases });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}