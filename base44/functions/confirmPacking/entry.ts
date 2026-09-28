import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

async function hasWarehouseAccess(base44, user, allowedPages) {
  if (user?.role === 'admin') return true;
  if (['warehouse', 'operations_manager'].includes(user?.custom_role)) return true;
  if (!user?.custom_role) return false;
  const roles = await base44.asServiceRole.entities.RoleConfig.filter({ role_code: user.custom_role, is_active: true }, '-updated_date', 1);
  const role = roles?.[0];
  const visiblePages = role?.visible_pages || [];
  return allowedPages.some((page) => visiblePages.includes(page));
}

async function loadPackagesForRequest(base44, request) {
  if (Array.isArray(request?.package_ids) && request.package_ids.length) {
    const items = await Promise.all(request.package_ids.map(async (id) => {
      try { return await base44.asServiceRole.entities.Package.get(id); } catch { return null; }
    }));
    return items.filter(Boolean);
  }

  if (Array.isArray(request?.tracking_numbers) && request.tracking_numbers.length) {
    const items = await Promise.all(request.tracking_numbers.map(async (tracking) => {
      const result = await base44.asServiceRole.entities.Package.filter({ tracking_number: tracking }, '-updated_date', 1);
      return result?.[0] || null;
    }));
    return items.filter(Boolean);
  }

  return [];
}

async function recalcLocation(base44, locationId) {
  if (!locationId) return;
  const packages = await base44.asServiceRole.entities.Package.filter({ warehouse_location_id: locationId }, '-updated_date', 500);
  await base44.asServiceRole.entities.WarehouseLocation.update(locationId, {
    current_units: packages.length,
    current_weight_kg: Number(packages.reduce((sum, pkg) => sum + Number(pkg.actual_weight_kg || 0), 0).toFixed(3)),
    current_volume_cbm: Number(packages.reduce((sum, pkg) => sum + Number(pkg.actual_cbm || 0), 0).toFixed(6))
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await hasWarehouseAccess(base44, user, ['WarehousePickPackShip']))) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const requestId = String(body?.request_id || '').trim();
    const targetLocationId = body?.target_location_id ? String(body.target_location_id).trim() : '';
    // Fotos capturadas automáticamente por el escáner de picking/packing,
    // indexadas por tracking_number del paquete empaquetado.
    const photosByTracking = (body?.photos_by_tracking && typeof body.photos_by_tracking === 'object')
      ? body.photos_by_tracking
      : {};
    if (!requestId) return Response.json({ error: 'request_id es obligatorio' }, { status: 400 });

    const request = await base44.asServiceRole.entities.ConsolidationRequest.get(requestId);
    if (!request) return Response.json({ error: 'Solicitud no encontrada' }, { status: 404 });

    const packages = await loadPackagesForRequest(base44, request);
    let targetLocation = null;
    if (targetLocationId) {
      targetLocation = await base44.asServiceRole.entities.WarehouseLocation.get(targetLocationId);
      if (!targetLocation || targetLocation.is_active === false) {
        return Response.json({ error: 'Ubicación destino no válida' }, { status: 404 });
      }
    }

    const touchedLocations = new Set();
    await Promise.all(packages.map(async (pkg) => {
      const noteLine = `Packing confirmado por ${user.email} el ${new Date().toISOString()}`;
      const nextNotes = pkg.reception_notes ? `${pkg.reception_notes}\n${noteLine}` : noteLine;
      const updates = {
        reception_notes: nextNotes
      };

      if (targetLocation) {
        updates.warehouse_location_id = targetLocation.id;
        updates.warehouse_location_code = targetLocation.code;
        updates.warehouse_location_name = targetLocation.name;
        updates.warehouse_zone = targetLocation.zone;
      }

      // Foto del paquete capturada al escanearlo para empacar: se agrega a las
      // imágenes del paquete (máximo 3, se conservan las más recientes).
      const photoUrl = String(photosByTracking[pkg.tracking_number] || '').trim();
      if (photoUrl) {
        const existingUrls = Array.isArray(pkg.package_image_urls)
          ? pkg.package_image_urls.filter(Boolean)
          : (pkg.package_image_url ? [pkg.package_image_url] : []);
        updates.package_image_urls = [...existingUrls, photoUrl]
          .filter((url, index, arr) => arr.indexOf(url) === index)
          .slice(-3);
        if (!pkg.package_image_url) updates.package_image_url = photoUrl;
      }

      await base44.asServiceRole.entities.Package.update(pkg.id, updates);
      if (pkg.warehouse_location_id) touchedLocations.add(pkg.warehouse_location_id);
    }));

    if (targetLocation) touchedLocations.add(targetLocation.id);
    await Promise.all(Array.from(touchedLocations).map((id) => recalcLocation(base44, id)));

    const noteLine = `Packing confirmado por ${user.email} el ${new Date().toISOString()}`;
    const notes = request.notes ? `${request.notes}\n${noteLine}` : noteLine;
    await base44.asServiceRole.entities.ConsolidationRequest.update(request.id, { notes });

    return Response.json({ success: true, packed_packages: packages.length, target_location: targetLocation || null });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});