import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { connectionKeyOf, connectionLabel, listWholesalerConnections } from '../../shared/wholesalerCore.ts';
import { passwordDenied, passwordError, passwordFields, stripPassword } from '../../shared/accessPassword.ts';
import { buildPortalData } from '../../shared/wholesalerPortalData.ts';

// Portal privado del mayorista. Acciones públicas: 'access' (con token secreto
// y contraseña) devuelve SOLO los clientes, trackings y facturas de ese
// mayorista. Acciones admin: 'admin_get', 'admin_generate', 'admin_password'.
const rows = (r: any) => (Array.isArray(r) ? r : r?.items || []);

async function activeLink(base44: any, key: string) {
  const found = rows(await base44.asServiceRole.entities.WholesalerPortalLink.filter({ wholesaler_key: key, active: true }, '-created_date', 1));
  return found[0] || null;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '');

    if (action === 'access') {
      const token = String(body?.token || '').trim();
      if (token.length < 30) return Response.json({ error: 'Enlace no válido' }, { status: 404 });
      const link = rows(await base44.asServiceRole.entities.WholesalerPortalLink.filter({ token, active: true }, '-created_date', 1))[0];
      if (!link) return Response.json({ error: 'Enlace no válido' }, { status: 404 });
      if (!link.access_password_hash) return passwordDenied('El portal aún no tiene contraseña configurada');
      const denied = await passwordError(link, body?.password);
      if (denied) return passwordDenied(denied);

      const data = await buildPortalData(base44, link.wholesaler_key);
      if (!data) return Response.json({ error: 'Enlace no válido' }, { status: 404 });
      await base44.asServiceRole.entities.WholesalerPortalLink.update(link.id, { last_access_date: new Date().toISOString() }).catch(() => null);
      return Response.json(data);
    }

    const user = await base44.auth.me().catch((e: any) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user || user.role !== 'admin') return Response.json({ error: 'Acceso solo para personal autorizado' }, { status: 403 });
    const key = String(body?.wholesaler_key || '').trim();
    if (!key) return Response.json({ error: 'Falta el mayorista' }, { status: 400 });
    const connections = await listWholesalerConnections(base44);
    const live = connections.find((c: any) => connectionKeyOf(c) === key);
    if (!live) return Response.json({ error: 'Ese mayorista no existe' }, { status: 404 });

    if (action === 'admin_get') {
      return Response.json({ ok: true, link: stripPassword(await activeLink(base44, key)) });
    }
    if (action === 'admin_generate') {
      const old = await activeLink(base44, key);
      if (old) await base44.asServiceRole.entities.WholesalerPortalLink.update(old.id, { active: false });
      const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
      const created = await base44.asServiceRole.entities.WholesalerPortalLink.create({
        wholesaler_key: key,
        wholesaler_name: connectionLabel(live),
        token,
        active: true,
        created_by: user.email,
        access_password_hash: old?.access_password_hash || '',
        access_password_salt: old?.access_password_salt || '',
      });
      return Response.json({ ok: true, link: stripPassword(created) });
    }
    if (action === 'admin_password') {
      const link = await activeLink(base44, key);
      if (!link) return Response.json({ error: 'Primero genera el enlace del portal' }, { status: 400 });
      if (String(body?.password || '').trim().length < 6) return Response.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
      const updated = await base44.asServiceRole.entities.WholesalerPortalLink.update(link.id, await passwordFields(body.password));
      return Response.json({ ok: true, link: stripPassword({ ...link, ...updated }) });
    }
    return Response.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as any)?.message || 'Error del portal' }, { status: 500 });
  }
}