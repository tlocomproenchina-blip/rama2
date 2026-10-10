import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { markPackagesReceivedIfMissing } from '../../shared/bultoScan.ts';

// Sincroniza un bulto cerrado (creado offline) con todos sus paquetes al servidor.
// Recibe:
//   { local_bulto_id, label_code, client_email, shipping_mark, bulto_number, total_bultos,
//     package_ids: string[], package_trackings: string[], client_snapshot, invoice_paid,
//     invoice_status, invoice_number, warehouse_id, created_by, closed_at }
// Idempotente por local_bulto_id: si ya existe un bulto con ese label_code, no lo recrea.
// Crea el Bulto con status 'cerrado' (sellado, esperando despacho manual en WarehouseDispatch),
// marca los Packages como 'recibido', y crea el DispatchOrder.
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
      cbm_order_numbers,
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
    const rawPackageIds: string[] = Array.isArray(package_ids) ? package_ids.filter(Boolean) : [];
    const rawTrackings: string[] = Array.isArray(package_trackings) ? package_trackings.filter(Boolean) : [];
    // Los ids del escaneo offline ('local_pkg_...') no existen como Package en el
    // servidor: sus códigos se guardan como 'sin registrar' para que el bulto no
    // quede con ids fantasma (rompían la edición del bulto).
    const validPackageIds = rawPackageIds.filter((id) => !String(id).startsWith('local_'));
    const validTrackings = rawTrackings;
    const unregisteredFromLocal: string[] = rawPackageIds
      .map((id, i) => (String(id).startsWith('local_') ? rawTrackings[i] || '' : ''))
      .filter(Boolean);

    // Todos los bultos nacen 'en_almacen_ve' (sellados en el almacén, esperando despacho al cliente).
    // Las etiquetas vacías creadas en lote también: antes nacían como 'despachado' y aparecían
    // como entregadas sin haber salido del almacén. El paso a 'despachado' es manual en WarehouseDispatch.
    const bultoStatus = 'en_almacen_ve';

    // Auto-lookup CbmIngreso order numbers if not provided manually
    let finalOrderNumbers: string[] = Array.isArray(cbm_order_numbers) ? cbm_order_numbers.filter(Boolean) : [];
    if (finalOrderNumbers.length === 0 && validTrackings.length > 0) {
      try {
        const cbms = await base44.asServiceRole.entities.CbmIngreso.filter(
          { client_email }, '-fecha', 200
        );
        const trackingSet = new Set(validTrackings);
        for (const c of cbms || []) {
          const tn = Array.isArray(c.tracking_numbers) ? c.tracking_numbers : [];
          if (tn.some((t: string) => trackingSet.has(t)) && c.invoice_number) {
            finalOrderNumbers.push(c.invoice_number);
          }
        }
      } catch (_) {}
    }

    // Crear el bulto en el servidor
    const newBulto = await base44.asServiceRole.entities.Bulto.create({
      label_code,
      client_email,
      shipping_mark: shipping_mark || '',
      bulto_number: bulto_number || 1,
      total_bultos: total_bultos || bulto_number || 1,
      package_ids: validPackageIds,
      package_trackings: validTrackings,
      unregistered_codes: unregisteredFromLocal,
      cbm_order_numbers: finalOrderNumbers,
      client_snapshot: client_snapshot || {},
      invoice_paid: !!invoice_paid,
      invoice_status: invoice_status || '',
      invoice_number: invoice_number || '',
      warehouse_id: warehouse_id || '',
      status: bultoStatus,
      created_by: created_by || user.email || '',
    });

    // Los paquetes que entran al bulto quedan recibidos en el almacén (no 'despachado':
    // ese paso es manual en WarehouseDispatch). Los que ya tenían recepción registrada
    // la conservan: no se vuelve a contar ni se mueve su fecha de recepción.
    await markPackagesReceivedIfMissing(
      base44,
      validPackageIds,
      closed_at || new Date().toISOString(),
      created_by || user.email || ''
    );

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