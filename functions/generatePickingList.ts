import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function hasWarehouseAccess(user) {
  return user?.role === 'admin' || ['warehouse', 'operations_manager'].includes(user?.custom_role);
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasWarehouseAccess(user)) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const requestId = String(body?.request_id || '').trim();
    if (!requestId) return Response.json({ error: 'request_id es obligatorio' }, { status: 400 });

    const request = await base44.asServiceRole.entities.ConsolidationRequest.get(requestId);
    if (!request) return Response.json({ error: 'Solicitud no encontrada' }, { status: 404 });

    const packages = await loadPackagesForRequest(base44, request);
    const sortedPackages = packages.sort((a, b) => {
      const zoneCompare = String(a.warehouse_zone || 'zzz').localeCompare(String(b.warehouse_zone || 'zzz'));
      if (zoneCompare !== 0) return zoneCompare;
      const codeCompare = String(a.warehouse_location_code || 'zzz').localeCompare(String(b.warehouse_location_code || 'zzz'));
      if (codeCompare !== 0) return codeCompare;
      return String(a.tracking_number || '').localeCompare(String(b.tracking_number || ''));
    });

    const summary = {
      package_count: sortedPackages.length,
      located_count: sortedPackages.filter((pkg) => pkg.warehouse_location_id).length,
      unlocated_count: sortedPackages.filter((pkg) => !pkg.warehouse_location_id).length,
      total_weight_kg: Number(sortedPackages.reduce((sum, pkg) => sum + Number(pkg.actual_weight_kg || 0), 0).toFixed(3)),
      total_cbm: Number(sortedPackages.reduce((sum, pkg) => sum + Number(pkg.actual_cbm || 0), 0).toFixed(6))
    };

    return Response.json({ success: true, request, summary, packages: sortedPackages });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});