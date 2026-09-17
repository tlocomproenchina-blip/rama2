import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

// Actualiza un bulto existente. Recibe: { bulto_id, package_ids?, client_snapshot?, status? }
// - Valida que los package_ids sean del mismo cliente del bulto.
// - Valida que los paquetes no estén ya en otro bulto del mismo cliente.
// - Si cambian los package_ids, recalcula package_trackings cache.
// - Actualiza client_snapshot y status si vienen.
// No recalcula bulto_number (el número se mantiene estable; el total_bultos solo cambia con create/delete).
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const bultoId: string = body.bulto_id || '';
    if (!bultoId) return Response.json({ error: 'Falta bulto_id' }, { status: 400 });

    const bulto = await base44.asServiceRole.entities.Bulto.get(bultoId).catch(() => null);
    if (!bulto) return Response.json({ error: 'Bulto no encontrado' }, { status: 404 });

    const update: any = {};

    // --- Paquetes ---
    if (Array.isArray(body.package_ids)) {
      const packageIds: string[] = body.package_ids.filter(Boolean);
      if (!packageIds.length) return Response.json({ error: 'El bulto debe tener al menos un paquete' }, { status: 400 });

      // Fetch paquetes seleccionados
      const pkgResults = await Promise.all(
        packageIds.map((id) => base44.asServiceRole.entities.Package.get(id).catch(() => null))
      );
      const pkgs = pkgResults.filter((p) => p) as any[];
      if (!pkgs.length) return Response.json({ error: 'No se encontraron los paquetes' }, { status: 404 });

      const clientEmail = bulto.client_email;
      const sameClient = pkgs.every((p) => p.client_email === clientEmail);
      if (!sameClient) return Response.json({ error: 'Todos los paquetes deben ser del mismo cliente del bulto' }, { status: 400 });

      // Validar que los paquetes no estén en OTRO bulto del mismo cliente
      const otherBultos = await base44.asServiceRole.entities.Bulto.filter(
        { client_email: clientEmail }, 'bulto_number', 500
      );
      const otherPackageIds = new Set<string>();
      for (const b of otherBultos) {
        if (b.id === bultoId) continue;
        for (const pid of b.package_ids || []) otherPackageIds.add(pid);
      }
      const conflict = packageIds.filter((id) => otherPackageIds.has(id));
      if (conflict.length) {
        return Response.json({ error: 'Algunos paquetes ya están en otro bulto del cliente' }, { status: 400 });
      }

      update.package_ids = packageIds;
      update.package_trackings = pkgs.map((p) => p.tracking_number || '').filter(Boolean);
    }

    // --- Snapshot del cliente ---
    if (body.client_snapshot && typeof body.client_snapshot === 'object') {
      const cs = body.client_snapshot;
      const current = bulto.client_snapshot || {};
      update.client_snapshot = {
        full_name: cs.full_name ?? current.full_name ?? '',
        email: cs.email ?? current.email ?? bulto.client_email,
        cedula: cs.cedula ?? current.cedula ?? '',
        whatsapp: cs.whatsapp ?? current.whatsapp ?? '',
        address: cs.address ?? current.address ?? '',
        city: cs.city ?? current.city ?? '',
        state: cs.state ?? current.state ?? '',
        shipping_mark: cs.shipping_mark ?? current.shipping_mark ?? bulto.shipping_mark,
      };
    }

    // --- Estado ---
    if (body.status) {
      if (!['activo', 'despachado'].includes(body.status)) {
        return Response.json({ error: 'Estado inválido' }, { status: 400 });
      }
      update.status = body.status;
    }

    const updated = await base44.asServiceRole.entities.Bulto.update(bultoId, update);

    return Response.json({ bulto: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}