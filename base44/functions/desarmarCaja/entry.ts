import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { freeLabelCode } from '../../shared/bultoNumber.ts';

// Desarmar una caja consolidada.
//
// Al fusionar unidades en el historial, la caja nueva guarda en absorbed_bultos el detalle
// de cada unidad que quedó dentro (etiqueta, paquetes, N° de orden, estado). Desarmar lee
// ese detalle y vuelve a crear cada unidad original con sus paquetes, para que el cliente
// las tenga disponibles otra vez; al final la caja consolidada se elimina.
//
// Reglas:
// - Solo administradores.
// - No se desarma una caja facturada ni despachada (su carga ya salió del almacén).
// - Se conserva la etiqueta original de cada bulto si sigue libre, para que lo que ya está
//   pegado siga sirviendo; si choca con otro bulto se reserva una etiqueta nueva.
// - Un paquete nunca queda en dos unidades restauradas.
const text = (value: any) => String(value ?? '').trim();
const uniq = (list: any[]) => [...new Set((list || []).map(text).filter(Boolean))];

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Solo administradores pueden desarmar cajas' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const bultoId = text(body.bulto_id);
    if (!bultoId) return Response.json({ error: 'Falta la caja a desarmar.' }, { status: 400 });

    const caja = await base44.asServiceRole.entities.Bulto.get(bultoId).catch(() => null);
    if (!caja?.id) return Response.json({ error: 'La caja ya no existe.' }, { status: 400 });
    if (!caja.is_caja) {
      return Response.json({ error: 'Solo se pueden desarmar cajas consolidadas.' }, { status: 400 });
    }
    if (text(caja.billed_invoice_id)) {
      return Response.json({ error: 'La caja ya está facturada: no se puede desarmar.' }, { status: 400 });
    }
    if (text(caja.status) === 'despachado') {
      return Response.json({ error: 'La caja ya fue despachada: no se puede desarmar.' }, { status: 400 });
    }

    const absorbed: any[] = Array.isArray(caja.absorbed_bultos) ? caja.absorbed_bultos : [];
    if (!absorbed.length) {
      return Response.json({
        error: 'Esta caja no tiene el detalle de sus bultos originales, así que no se puede desarmar.',
      }, { status: 400 });
    }

    // Paquete por tracking: es lo que permite devolver cada paquete a su bulto de origen.
    const cajaPackageIds = uniq(caja.package_ids || []);
    const packages = (await Promise.all(
      cajaPackageIds.map((id) => base44.asServiceRole.entities.Package.get(id).catch(() => null))
    )).filter((p: any) => p) as any[];
    const packageByTracking = new Map<string, string>();
    for (const pkg of packages) {
      const track = text(pkg.tracking_number);
      if (track && !packageByTracking.has(track)) packageByTracking.set(track, pkg.id);
    }
    // Respaldo posicional: el tracking guardado en la caja apunta a su paquete.
    const cajaTrackings = caja.package_trackings || [];
    cajaTrackings.forEach((code: any, index: number) => {
      const id = text(cajaPackageIds[index]);
      const track = text(code);
      if (id && track && !packageByTracking.has(track)) packageByTracking.set(track, id);
    });

    const mark = text(caja.shipping_mark) || text(caja.client_snapshot?.shipping_mark);
    const clientEmail = text(caja.client_email);
    const cajaStatus = text(caja.status);
    const usedPackageIds = new Set<string>();
    const usedCodes = new Set<string>();
    const restored: any[] = [];
    const failed: string[] = [];

    for (const entry of absorbed) {
      const codes = uniq(entry.trackings || []);
      const packageIds: string[] = [];
      const trackings: string[] = [];
      const unregistered: string[] = [];

      for (const code of codes) {
        const packageId = packageByTracking.get(code);
        if (packageId) {
          if (usedPackageIds.has(packageId)) continue;
          usedPackageIds.add(packageId);
          packageIds.push(packageId);
          trackings.push(code);
        } else if (!usedCodes.has(code)) {
          usedCodes.add(code);
          unregistered.push(code);
        }
      }

      const preferred = text(entry.label_code);
      const label = await freeLabelCode(base44, preferred);
      if (!label) {
        failed.push(preferred || 'sin etiqueta');
        continue;
      }

      const status =
        text(entry.status) === 'en_almacen_ve' || cajaStatus === 'en_almacen_ve'
          ? 'en_almacen_ve'
          : 'cerrado';

      try {
        const bulto = await base44.asServiceRole.entities.Bulto.create({
          label_code: label.label_code,
          is_caja: false,
          client_email: clientEmail,
          shipping_mark: mark,
          bulto_number: label.number || Number(entry.bulto_number) || 0,
          total_bultos: Number(caja.total_bultos) || 1,
          package_ids: packageIds,
          package_trackings: trackings,
          unregistered_codes: unregistered,
          cbm_order_numbers: uniq(entry.order_numbers || []),
          client_snapshot: caja.client_snapshot || {},
          warehouse_id: text(caja.warehouse_id),
          status,
          print_count: entry.printed ? 1 : 0,
          ve_recognized_date: caja.ve_recognized_date || undefined,
          ve_recognized_by: text(caja.ve_recognized_by),
          created_by: user.email || '',
        });
        restored.push({
          id: bulto.id,
          label_code: bulto.label_code,
          package_count: packageIds.length + unregistered.length,
        });
      } catch (e: any) {
        failed.push(preferred || 'sin etiqueta');
      }
    }

    if (!restored.length) {
      return Response.json({
        error: 'No se pudo restaurar ningún bulto. La caja quedó como estaba.',
        failed,
      }, { status: 500 });
    }

    // Paquetes que quedaron sin unidad (datos viejos): se devuelven al primer bulto
    // restaurado para que ningún paquete se pierda al eliminar la caja.
    const leftoverIds = cajaPackageIds.filter((id) => !usedPackageIds.has(id));
    const leftoverCodes = uniq(caja.package_trackings || [])
      .filter((code) => !usedCodes.has(code) && !packageByTracking.has(code));
    if (leftoverIds.length || leftoverCodes.length) {
      const target = restored[0];
      const patched = await base44.asServiceRole.entities.Bulto.get(target.id).catch(() => null);
      if (patched) {
        const extraTrackings = leftoverIds
          .map((id) => packages.find((p) => p.id === id)?.tracking_number)
          .map(text)
          .filter(Boolean);
        await base44.asServiceRole.entities.Bulto.update(target.id, {
          package_ids: uniq([...(patched.package_ids || []), ...leftoverIds]),
          package_trackings: uniq([...(patched.package_trackings || []), ...extraTrackings]),
          unregistered_codes: uniq([...(patched.unregistered_codes || []), ...leftoverCodes]),
        }).catch(() => null);
      }
    }

    // La caja ya no existe: sus bultos originales vuelven a estar disponibles.
    await base44.asServiceRole.entities.Bulto.delete(caja.id);

    // Recuadra X/Y del cliente (sin tocar label_code: las etiquetas ya impresas siguen sirviendo).
    if (clientEmail) {
      const remaining = await base44.asServiceRole.entities.Bulto
        .filter({ client_email: clientEmail }, 'bulto_number', 500)
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
      caja_label: text(caja.label_code),
      restored_count: restored.length,
      restored,
      failed,
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'No se pudo desarmar la caja' }, { status: 500 });
  }
}