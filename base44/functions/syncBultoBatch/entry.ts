import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { markPackagesReceivedIfMissing } from '../../shared/bultoScan.ts';
import { planCombinedSources, deleteCombinedSources } from '../../shared/combineSources.ts';
import { isSameWork, reassignLabelCode, settleCreateRace } from '../../shared/labelConflict.ts';
import { findTrackingOwners, publicOwner, settleTrackingRace } from '../../shared/trackingDuplicates.ts';
import { dedupeUnitContents } from '../../shared/unitDedupe.ts';

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

    const rawPackageIds: string[] = Array.isArray(package_ids) ? package_ids.filter(Boolean) : [];
    const rawTrackings: string[] = Array.isArray(package_trackings) ? package_trackings.filter(Boolean) : [];
    const localUnitId = String(local_bulto_id || '').trim();
    let labelCode = String(label_code).trim();
    let bultoNumber = bulto_number;
    let relabeled: any = null;

    // Idempotencia: un reintento del mismo bulto devuelve el ya registrado. Si el código
    // lo tiene OTRA unidad (otro operador), esa lo conserva y este bulto recibe uno nuevo.
    const existing = await base44.asServiceRole.entities.Bulto.filter({ label_code: labelCode }, '-created_date', 1);
    if (existing?.[0]) {
      if (isSameWork(existing[0], localUnitId, rawTrackings)) {
        return Response.json({
          success: true,
          bulto: existing[0],
          already_exists: true,
          synced: true,
        });
      }
      const fresh = await reassignLabelCode(base44, labelCode, 'B');
      if (!fresh) {
        return Response.json({ error: `El código ${labelCode} ya está usado y no se pudo asignar uno nuevo. Reintenta.` }, { status: 500 });
      }
      relabeled = { from: labelCode, to: fresh.label_code, number: fresh.number };
      labelCode = fresh.label_code;
      bultoNumber = fresh.number;
    }
    // Unidades combinadas en la mesa de empaque: su contenido pasa a este bulto nuevo y las
    // originales se eliminan recién cuando el bulto ya quedó creado.
    const combineCodes: string[] = Array.isArray(body.combine_codes)
      ? body.combine_codes.map((c: any) => String(c || '').trim()).filter(Boolean)
      : [];

    // Trackings que ya están en otra caja o bulto: no se registran dos veces.
    const dupOpts = { excludeLocalUnitId: localUnitId, excludeOpenUnitId: localUnitId, excludeLabels: combineCodes };
    const duplicates = rawTrackings.length
      ? await findTrackingOwners(base44, rawTrackings.map((code) => ({ code })), dupOpts)
      : [];
    const dupCodes = new Set(duplicates.map((o: any) => String(o.code).toUpperCase()));
    const dupIds = new Set(duplicates.flatMap((o: any) => o.package_ids || []));
    const keptTrackings = rawTrackings.filter((t) => !dupCodes.has(String(t).toUpperCase()));
    const keptPackageIds = rawPackageIds.filter((id) => !dupIds.has(id));
    if (rawTrackings.length && !keptTrackings.length && !combineCodes.length) {
      return Response.json({ success: false, duplicate: true, duplicates: duplicates.map(publicOwner) });
    }

    // Los ids del escaneo offline ('local_pkg_...') no existen como Package en el
    // servidor: sus códigos se guardan como 'sin registrar' para que el bulto no
    // quede con ids fantasma (rompían la edición del bulto).
    const validPackageIds = keptPackageIds.filter((id) => !String(id).startsWith('local_'));
    const validTrackings = keptTrackings;
    const unregisteredFromLocal: string[] = rawPackageIds
      .map((id, i) => (String(id).startsWith('local_') ? rawTrackings[i] || '' : ''))
      .filter((code) => code && !dupCodes.has(String(code).toUpperCase()));
    const combined = combineCodes.length
      ? await planCombinedSources(base44, {
          codes: combineCodes,
          clientEmail: client_email,
          actor: created_by || user.email || '',
        })
      : null;
    // Cada tracking cuenta una sola vez: sin repetidos (aunque cambien las mayúsculas) y
    // sin contar como "sin registrar" el tracking de un paquete registrado del bulto.
    const registeredCodes = rawTrackings.filter((_, i) => {
      const id = String(rawPackageIds[i] || '');
      return id && !id.startsWith('local_') && !dupIds.has(id);
    });
    const deduped = dedupeUnitContents({
      package_ids: [...validPackageIds, ...(combined?.package_ids || [])],
      package_trackings: [...validTrackings, ...(combined?.trackings || [])],
      unregistered_codes: [...unregisteredFromLocal, ...(combined?.unregistered_codes || [])],
    }, registeredCodes);
    const mergedPackageIds = deduped.package_ids;
    const mergedTrackings = deduped.package_trackings;
    const mergedUnregistered = deduped.unregistered_codes;

    // Todos los bultos nacen 'en_almacen_ve' (sellados en el almacén, esperando despacho al cliente).
    // Las etiquetas vacías creadas en lote también: antes nacían como 'despachado' y aparecían
    // como entregadas sin haber salido del almacén. El paso a 'despachado' es manual en WarehouseDispatch.
    const bultoStatus = 'en_almacen_ve';

    // Auto-lookup CbmIngreso order numbers if not provided manually
    let finalOrderNumbers: string[] = Array.isArray(cbm_order_numbers) ? cbm_order_numbers.filter(Boolean) : [];
    if (finalOrderNumbers.length === 0 && mergedTrackings.length > 0) {
      try {
        const cbms = await base44.asServiceRole.entities.CbmIngreso.filter(
          { client_email }, '-fecha', 200
        );
        const trackingSet = new Set(mergedTrackings);
        for (const c of cbms || []) {
          const tn = Array.isArray(c.tracking_numbers) ? c.tracking_numbers : [];
          if (tn.some((t: string) => trackingSet.has(t)) && c.invoice_number) {
            finalOrderNumbers.push(c.invoice_number);
          }
        }
      } catch (_) {}
    }
    // El N° de contenedor que traían las unidades combinadas también cuenta.
    const mergedOrderNumbers = [
      ...new Set([...finalOrderNumbers, ...(combined?.order_numbers || [])]),
    ];

    // Crear el bulto en el servidor
    let newBulto = await base44.asServiceRole.entities.Bulto.create({
      label_code: labelCode,
      local_unit_id: localUnitId,
      ...(relabeled ? { relabeled_from: relabeled.from } : {}),
      client_email,
      shipping_mark: shipping_mark || '',
      bulto_number: bultoNumber || 1,
      total_bultos: total_bultos || bultoNumber || 1,
      package_ids: mergedPackageIds,
      package_trackings: mergedTrackings,
      unregistered_codes: mergedUnregistered,
      cbm_order_numbers: mergedOrderNumbers,
      absorbed_bultos: combined?.absorbed || [],
      client_snapshot: client_snapshot || {},
      invoice_paid: !!invoice_paid,
      invoice_status: invoice_status || '',
      invoice_number: invoice_number || '',
      warehouse_id: warehouse_id || '',
      status: bultoStatus,
      created_by: created_by || user.email || '',
      // Hora real del cierre en el dispositivo (aunque se haya cerrado sin conexión).
      ...(closed_at ? { device_closed_date: closed_at } : {}),
    });

    // Otro bulto se registró con el mismo código en el mismo instante.
    if (rawTrackings.length) {
      const race = await settleCreateRace(base44, newBulto, 'B');
      newBulto = race.record;
      if (race.relabeled) relabeled = { ...race.relabeled, from: relabeled?.from || race.relabeled.from };
    }

    // Otro operador registró el mismo tracking en el mismo instante: lo conserva el
    // bulto que quedó primero.
    if (keptTrackings.length) {
      const settled = await settleTrackingRace(base44, newBulto, keptTrackings, dupOpts);
      duplicates.push(...settled.lost);
      if (settled.deleted) {
        return Response.json({ success: false, duplicate: true, duplicates: duplicates.map(publicOwner) });
      }
      newBulto = settled.record;
    }

    // Los paquetes que entran al bulto quedan recibidos en el almacén (no 'despachado':
    // ese paso es manual en WarehouseDispatch). Los que ya tenían recepción registrada
    // la conservan: no se vuelve a contar ni se mueve su fecha de recepción.
    await markPackagesReceivedIfMissing(
      base44,
      mergedPackageIds,
      closed_at || new Date().toISOString(),
      created_by || user.email || ''
    );

    // El contenido ya vive en el bulto nuevo: se eliminan las unidades combinadas.
    const combinedDeleted = await deleteCombinedSources(base44, combined?.deletable || []);

    return Response.json({
      success: true,
      bulto: newBulto,
      already_exists: false,
      synced: true,
      relabeled,
      duplicates: duplicates.map(publicOwner),
      combined: {
        deleted: combinedDeleted.deleted,
        failed: combinedDeleted.failed,
        warnings: [...(combined?.warnings || [])],
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}