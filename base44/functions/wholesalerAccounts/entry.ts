import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { connectionLabel } from '../../shared/wholesalerCore.ts';
import { buildPortalData, findConnection } from '../../shared/wholesalerPortalData.ts';

// Cuentas individuales de mayoristas dentro de la app principal.
// 'me': el usuario con sesión ve SOLO los datos del mayorista al que está asignado.
// 'admin_*': gestión de cuentas y marca (solo administradores).
const rows = (r: any) => (Array.isArray(r) ? r : r?.items || []);
const norm = (e: any) => String(e || '').trim().toLowerCase();

async function brandOf(base44: any, key: string) {
  return rows(await base44.asServiceRole.entities.WholesalerBrand.filter({ wholesaler_key: key }, '-updated_date', 1))[0] || null;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '');
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Inicia sesión' }, { status: 401 });
    const db = base44.asServiceRole.entities;

    if (action === 'me') {
      const account = rows(await db.WholesalerPortalUser.filter({ email: norm(user.email), active: true }, '-created_date', 1))[0];
      if (!account) return Response.json({ error: 'Tu cuenta no está asignada a ningún mayorista', not_wholesaler: true }, { status: 403 });
      const data = await buildPortalData(base44, account.wholesaler_key);
      if (!data) return Response.json({ error: 'El mayorista ya no está disponible', not_wholesaler: true }, { status: 403 });
      await db.WholesalerPortalUser.update(account.id, { last_access_date: new Date().toISOString() }).catch(() => null);
      const brand = await brandOf(base44, account.wholesaler_key);
      return Response.json({ ...data, brand: brand ? { display_name: brand.display_name, logo_url: brand.logo_url } : null });
    }

    if (user.role !== 'admin') return Response.json({ error: 'Acceso solo para personal autorizado' }, { status: 403 });
    const key = String(body?.wholesaler_key || '').trim();
    const live = key ? await findConnection(base44, key) : null;
    if (!live) return Response.json({ error: 'Ese mayorista no existe' }, { status: 404 });

    if (action === 'admin_list') {
      const users = rows(await db.WholesalerPortalUser.filter({ wholesaler_key: key }, '-created_date', 200));
      return Response.json({ ok: true, users, brand: await brandOf(base44, key) });
    }
    if (action === 'admin_add') {
      const email = norm(body?.email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: 'Email no válido' }, { status: 400 });
      const existing = rows(await db.WholesalerPortalUser.filter({ email }, '-created_date', 5));
      const other = existing.find((u: any) => u.wholesaler_key !== key && u.active !== false);
      if (other) return Response.json({ error: `Ese email ya pertenece al mayorista ${other.wholesaler_name || other.wholesaler_key}` }, { status: 409 });
      if (existing.find((u: any) => u.wholesaler_key === key)) return Response.json({ error: 'Ese email ya está asignado a este mayorista' }, { status: 409 });
      const created = await db.WholesalerPortalUser.create({
        wholesaler_key: key, wholesaler_name: connectionLabel(live), email,
        full_name: String(body?.full_name || '').trim(), active: true, added_by: user.email,
      });
      return Response.json({ ok: true, user: created });
    }
    if (action === 'admin_toggle' || action === 'admin_remove') {
      const target = await db.WholesalerPortalUser.get(String(body?.id || '')).catch(() => null);
      if (!target || target.wholesaler_key !== key) return Response.json({ error: 'Cuenta no encontrada' }, { status: 404 });
      if (action === 'admin_remove') await db.WholesalerPortalUser.delete(target.id);
      else await db.WholesalerPortalUser.update(target.id, { active: target.active === false });
      return Response.json({ ok: true });
    }
    if (action === 'admin_brand') {
      const fields = {
        display_name: String(body?.display_name || '').trim(),
        logo_url: String(body?.logo_url || '').trim(),
        domain: String(body?.domain || '').trim().toLowerCase(),
        updated_by: user.email,
      };
      const current = await brandOf(base44, key);
      const brand = current ? await db.WholesalerBrand.update(current.id, fields) : await db.WholesalerBrand.create({ wholesaler_key: key, ...fields });
      return Response.json({ ok: true, brand: { ...current, ...brand } });
    }
    return Response.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as any)?.message || 'Error de cuentas de mayorista' }, { status: 500 });
  }
}