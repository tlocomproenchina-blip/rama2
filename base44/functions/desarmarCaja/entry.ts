import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { freeLabelCode } from '../../shared/bultoNumber.ts';

// Desarmar una unidad (caja consolidada o bulto suelto) que absorbió otros bultos.
//
// Lee absorbed_bultos y vuelve a crear cada unidad original con sus paquetes. La unidad
// original NO se borra: queda con su historial (dismantle_history) y:
// - si ya no le queda contenido, pasa a estado "desarmado" (fuera de los conteos);
// - si es un bulto suelto con paquetes propios, los conserva y sigue con su estado.
// Si alguna unidad no se pudo restaurar, se queda dentro de la original para reintentar.
// Se permite aunque esté despachada o facturada (el usuario confirma en pantalla).
const text = (value: any) => String(value ?? '').trim();
const uniq = (list: any[]) => [...new Set((list || []).map(text).filter(Boolean))];

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  let lockedId = '';
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Solo administradores pueden desarmar unidades' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const bultoId = text(body.bulto_id);
    if (!bultoId) return Response.json({ error: 'Falta la unidad a desarmar.' }, { status: 400 });

    const parent = await base44.asServiceRole.entities.Bulto.get(bultoId).catch(() => null);
    if (!parent?.id) return Response.json({ error: 'La unidad ya no existe.' }, { status: 400 });
    if (text(parent.status) === 'desarmado') {
      return Response.json({ error: 'Esta unidad ya fue desarmada.' }, { status: 400 });
    }
    const absorbed: any[] = Array.isArray(parent.absorbed_bultos) ? parent.absorbed_bultos : [];
    if (!absorbed.length) {
      return Response.json({ error: 'Esta unidad no tiene bultos absorbidos para separar.' }, { status: 400 });
    }

    // Bloqueo: dos pulsaciones no pueden restaurar los mismos bultos dos veces.
    const lock = await base44.asServiceRole.entities.Bulto.updateMany(
      { id: parent.id, dismantle_in_progress: { $ne: true } },
      { $set: { dismantle_in_progress: true } }
    );
    if (!(lock?.updated >= 1)) {
      return Response.json({ error: 'Esta unidad ya se está desarmando. Espera unos segundos.' }, { status: 409 });
    }
    lockedId = parent.id;

    const parentPackageIds = uniq(parent.package_ids || []);
    const parentTrackings = uniq(parent.package_trackings || []);
    const parentUnregistered = uniq(parent.unregistered_codes || []);
    const packages = (await Promise.all(
      parentPackageIds.map((id) => base44.asServiceRole.entities.Package.get(id).catch(() => null))
    )).filter((p: any) => p) as any[];
    const packageByTracking = new Map<string, string>();
    const trackingByPackage = new Map<string, string>();
    for (const pkg of packages) {
      const track = text(pkg.tracking_number);
      if (track && !packageByTracking.has(track)) packageByTracking.set(track, pkg.id);
      if (track) trackingByPackage.set(pkg.id, track);
    }
    (parent.package_trackings || []).forEach((code: any, index: number) => {
      const id = text(parentPackageIds[index]);
      const track = text(code);
      if (id && track && !packageByTracking.has(track)) packageByTracking.set(track, id);
      if (id && track && !trackingByPackage.has(id)) trackingByPackage.set(id, track);
    });

    const mark = text(parent.shipping_mark) || text(parent.client_snapshot?.shipping_mark);
    const clientEmail = text(parent.client_email);
    const parentStatus = text(parent.status);
    const usedPackageIds = new Set<string>();
    const usedCodes = new Set<string>();
    const restored: any[] = [];
    const failedEntries: any[] = [];

    for (const entry of absorbed) {
      const packageIds: string[] = [];
      const trackings: string[] = [];
      const unregistered: string[] = [];
      for (const code of uniq(entry.trackings || [])) {
        const packageId = packageByTracking.get(code);
        if (packageId) {
          if (usedPackageIds.has(packageId) || packageIds.includes(packageId)) continue;
          packageIds.push(packageId);
          trackings.push(code);
        } else if (!usedCodes.has(code) && !unregistered.includes(code)) {
          unregistered.push(code);
        }
      }

      const preferred = text(entry.label_code);
      const label = await freeLabelCode(base44, preferred);
      if (!label) {
        failedEntries.push(entry);
        continue;
      }

      const status = ['despachado', 'en_almacen_ve'].includes(parentStatus)
        ? parentStatus
        : (text(entry.status) === 'en_almacen_ve' ? 'en_almacen_ve' : 'cerrado');

      try {
        const bulto = await base44.asServiceRole.entities.Bulto.create({
          label_code: label.label_code,
          is_caja: false,
          client_email: clientEmail,
          shipping_mark: mark,
          bulto_number: label.number || Number(entry.bulto_number) || 0,
          total_bultos: Number(parent.total_bultos) || 1,
          package_ids: packageIds,
          package_trackings: trackings,
          unregistered_codes: unregistered,
          cbm_order_numbers: uniq(entry.order_numbers || []),
          client_snapshot: parent.client_snapshot || {},
          warehouse_id: text(parent.warehouse_id),
          status,
          print_count: entry.printed ? 1 : 0,
          ve_recognized_date: parent.ve_recognized_date || undefined,
          ve_recognized_by: text(parent.ve_recognized_by),
          created_by: user.email || '',
        });
        packageIds.forEach((id) => usedPackageIds.add(id));
        unregistered.forEach((c) => usedCodes.add(c));
        restored.push({
          id: bulto.id,
          label_code: bulto.label_code,
          original_label: preferred,
          package_count: packageIds.length + unregistered.length,
        });
      } catch (_) {
        failedEntries.push(entry);
      }
    }

    if (!restored.length) {
      await base44.asServiceRole.entities.Bulto.update(parent.id, { dismantle_in_progress: false });
      lockedId = '';
      return Response.json({
        error: 'No se pudo restaurar ningún bulto. La unidad quedó como estaba.',
        failed: failedEntries.map((e) => text(e.label_code) || 'sin etiqueta'),
      }, { status: 500 });
    }

    // Lo que no se restauró sigue en la unidad original.
    let remainingIds = parentPackageIds.filter((id) => !usedPackageIds.has(id));
    let remainingUnregistered = parentUnregistered.filter((c) => !usedCodes.has(c));
    const restoredTracks = new Set(
      [...usedPackageIds].map((id) => trackingByPackage.get(id)).filter(Boolean) as string[]
    );
    let remainingTrackings = parentTrackings.filter((t) => !restoredTracks.has(t) && !usedCodes.has(t));

    // Caja sin fallos: sus sobrantes (datos viejos) pasan al primer bulto restaurado.
    if (parent.is_caja && !failedEntries.length && (remainingIds.length || remainingUnregistered.length)) {
      const target = await base44.asServiceRole.entities.Bulto.get(restored[0].id).catch(() => null);
      if (target) {
        const extraTracks = remainingIds.map((id) => trackingByPackage.get(id)).filter(Boolean);
        await base44.asServiceRole.entities.Bulto.update(target.id, {
          package_ids: uniq([...(target.package_ids || []), ...remainingIds]),
          package_trackings: uniq([...(target.package_trackings || []), ...extraTracks]),
          unregistered_codes: uniq([...(target.unregistered_codes || []), ...remainingUnregistered]),
        });
        restored[0].package_count += remainingIds.length + remainingUnregistered.length;
        remainingIds = [];
        remainingUnregistered = [];
        remainingTrackings = [];
      }
    }

    const hasContent = remainingIds.length > 0 || remainingUnregistered.length > 0;
    const fullyDismantled = !failedEntries.length && !hasContent;
    const historyEntry = {
      dismantled_at: new Date().toISOString(),
      dismantled_by: user.email || '',
      previous_status: parentStatus,
      previous_package_ids: parentPackageIds,
      previous_trackings: parentTrackings,
      previous_unregistered_codes: parentUnregistered,
      previous_order_numbers: uniq(parent.cbm_order_numbers || []),
      previous_absorbed_bultos: absorbed,
      restored_labels: restored.map((r) => r.label_code),
      failed_labels: failedEntries.map((e) => text(e.label_code) || 'sin etiqueta'),
    };

    await base44.asServiceRole.entities.Bulto.update(parent.id, {
      package_ids: remainingIds,
      package_trackings: uniq([...remainingTrackings, ...remainingUnregistered]),
      unregistered_codes: remainingUnregistered,
      absorbed_bultos: failedEntries,
      cargo_package_count: null,
      dismantle_history: [...(parent.dismantle_history || []), historyEntry],
      dismantle_in_progress: false,
      ...(fullyDismantled ? { status: 'desarmado' } : {}),
    });
    lockedId = '';

    // Recuadra X/Y del cliente sin contar unidades desarmadas (sin tocar etiquetas).
    if (clientEmail) {
      const remaining = await base44.asServiceRole.entities.Bulto
        .filter({ client_email: clientEmail, status: { $ne: 'desarmado' } }, 'bulto_number', 500)
        .catch(() => []);
      if (remaining?.length) {
        await base44.asServiceRole.entities.Bulto.bulkUpdate(
          remaining.map((b: any, index: number) => ({
            id: b.id,
            bulto_number: index + 1,
            total_bultos: remaining.length,
          }))
        ).catch(() => null);
      }
    }

    return Response.json({
      success: true,
      parent_label: text(parent.label_code),
      parent_status: fullyDismantled ? 'desarmado' : parentStatus,
      parent_keeps_packages: remainingIds.length + remainingUnregistered.length,
      restored_count: restored.length,
      restored,
      failed: historyEntry.failed_labels,
    });
  } catch (error: any) {
    if (lockedId) {
      await base44.asServiceRole.entities.Bulto.update(lockedId, { dismantle_in_progress: false }).catch(() => null);
    }
    return Response.json({ error: error?.message || 'No se pudo desarmar la unidad' }, { status: 500 });
  }
}