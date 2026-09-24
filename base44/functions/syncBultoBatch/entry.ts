import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

// Sincroniza un bulto cerrado (creado offline) con todos sus paquetes al servidor.
// Recibe:
//   { local_bulto_id, label_code, client_email, shipping_mark, bulto_number, total_bultos,
//     package_ids: string[], package_trackings: string[], client_snapshot, invoice_paid,
//     invoice_status, invoice_number, warehouse_id, created_by, closed_at }
// Idempotente por local_bulto_id: si ya existe un bulto con ese label_code, no lo recrea.
// Crea el Bulto, marca los Packages como despachados, y crea el DispatchOrder.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const {
      local_bulto_id,
      label_code,
      client_email,
      shipping_mark,
      bulto_number,
      total_bultos,
      package_ids,
      package_trackings,
      client_snapshot,
      invoice_paid,
      invoice_status,
      invoice_number,
      warehouse_id,
      created_by,
      closed_at,
    } = body;

    if (!label_code || !client_email) {
      return Response.json({ error: 'label_code y client_email son requeridos' }, { status: 400 });
    }

    // Idempotencia: si ya existe un bulto con este label_code, devolverlo sin recrear
    const existing = await base44.asServiceRole.entities.Bulto.filter({ label_code }, '-created_date', 1);
    if (existing?.[0]) {
      return Response.json({
        success: true,
        bulto: existing[0],
        already_exists: true,
        synced: true,
      });
    }

    // Validar que los package_ids existan (fueron creados offline o ya existían)
    const validPackageIds = Array.isArray(package_ids) ? package_ids.filter(Boolean) : [];
    const validTrackings = Array.isArray(package_trackings) ? package_trackings.filter(Boolean) : [];

    // Bultos con paquetes: status 'activo' (esperando despacho manual en WarehouseDispatch).
    // Bultos vacíos (bulk/etiquetas): status 'despachado' (cajas pre-armadas sin contenido).
    const bultoStatus = validPackageIds.length > 0 ? 'activo' : 'despachado';

    // Crear el bulto en el servidor
    const newBulto = await base44.asServiceRole.entities.Bulto.create({
      label_code,
      client_email,
      shipping_mark: shipping_mark || '',
      bulto_number: bulto_number || 1,
      total_bultos: total_bultos || bulto_number || 1,
      package_ids: validPackageIds,
      package_trackings: validTrackings,
      client_snapshot: client_snapshot || {},
      invoice_paid: !!invoice_paid,
      invoice_status: invoice_status || '',
      invoice_number: invoice_number || '',
      warehouse_id: warehouse_id || '',
      status: bultoStatus,
      created_by: created_by || user.email || '',
    });

    // Los paquetes se marcan como 'recibido' (no 'despachado').
    // El paso a 'despachado' se hace manualmente en WarehouseDispatch.
    if (validPackageIds.length) {
      try {
        await base44.asServiceRole.entities.Package.bulkUpdate(
          validPackageIds.map((id) => ({
            id,
            status: 'recibido',
            received_date: closed_at || new Date().toISOString(),
            received_by: created_by || user.email || '',
          }))
        );
      } catch (_) {}
    }

    return Response.json({
      success: true,
      bulto: newBulto,
      already_exists: false,
      synced: true,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}