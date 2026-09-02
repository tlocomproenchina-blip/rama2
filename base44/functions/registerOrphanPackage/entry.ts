import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Solo roles de almacén / admin pueden registrar huérfanos
    const isWarehouse = user.role === 'admin' || user.custom_role === 'almacen' || user.custom_role === 'operaciones';
    if (!isWarehouse) {
      return Response.json({ error: 'Forbidden: se requiere rol de almacén o admin' }, { status: 403 });
    }

    const body = await req.json();
    const tracking = String(body.tracking_number || '').trim();
    if (!tracking) return Response.json({ error: 'Tracking requerido' }, { status: 400 });

    // No registrar huérfano si ya existe el tracking (sea huérfano o no)
    const existing = await base44.asServiceRole.entities.Package.filter({ tracking_number: tracking }, '-created_date', 1);
    if (existing.length > 0) {
      return Response.json({ error: 'Este número de tracking ya está registrado en el sistema' }, { status: 409 });
    }

    const warehouseId = String(body.warehouse_id || '').trim() || null;
    const locationId = String(body.location_id || '').trim() || null;

    // Resolver nombre de almacén
    let warehouseName = null;
    let warehouseCity = null;
    let warehouseCountry = null;
    if (warehouseId) {
      try {
        const whs = await base44.asServiceRole.entities.Warehouse.filter({ id: warehouseId }, '-created_date', 1);
        const wh = whs?.[0];
        if (wh) {
          warehouseName = wh.name || null;
          warehouseCity = wh.city || null;
          warehouseCountry = wh.country || null;
        }
      } catch (_) {}
    }

    // Resolver ubicación
    let locationCode = null;
    let locationName = null;
    let locationWarehouseId = null;
    if (locationId) {
      try {
        const locs = await base44.asServiceRole.entities.WarehouseLocation.filter({ id: locationId }, '-created_date', 1);
        const loc = locs?.[0];
        if (loc) {
          locationCode = loc.code || null;
          locationName = loc.name || null;
          locationWarehouseId = loc.warehouse_id || null;
        }
      } catch (_) {}
    }

    const finalWarehouseId = warehouseId || locationWarehouseId || null;

    const weight = body.actual_weight_kg ? parseFloat(body.actual_weight_kg) : null;
    const length = body.actual_length_cm ? parseFloat(body.actual_length_cm) : null;
    const width = body.actual_width_cm ? parseFloat(body.actual_width_cm) : null;
    const height = body.actual_height_cm ? parseFloat(body.actual_height_cm) : null;
    let actualCbm = null;
    if (length && width && height) {
      actualCbm = (length * width * height) / 1_000_000;
    }

    const photoUrl = body.package_image_url ? String(body.package_image_url) : null;
    const photoUrls = Array.isArray(body.package_image_urls) ? body.package_image_urls.slice(0, 3) : (photoUrl ? [photoUrl] : []);

    const created = await base44.asServiceRole.entities.Package.create({
      tracking_number: tracking,
      client_email: '',
      shipping_mark: body.shipping_mark ? String(body.shipping_mark).trim() : null,
      shipping_type: body.shipping_type === 'aereo' ? 'aereo' : 'maritimo',
      risk_category: body.risk_category === 'alto_riesgo' ? 'alto_riesgo' : 'general',
      package_count: Number(body.package_count) || 1,
      description: body.description ? String(body.description) : 'Paquete huérfano (sin pre-alerta)',
      status: 'sin_cliente',
      is_orphan: true,
      warehouse_id: finalWarehouseId,
      warehouse_name: warehouseName,
      warehouse_city: warehouseCity,
      warehouse_country: warehouseCountry,
      warehouse_location_id: locationId,
      warehouse_location_code: locationCode,
      warehouse_location_name: locationName,
      actual_weight_kg: weight,
      actual_length_cm: length,
      actual_width_cm: width,
      actual_height_cm: height,
      actual_cbm: actualCbm,
      reception_notes: body.reception_notes ? String(body.reception_notes) : null,
      package_image_url: photoUrl,
      package_image_urls: photoUrls,
      received_date: new Date().toISOString(),
      received_by: user.email,
    });

    return Response.json({ package: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});