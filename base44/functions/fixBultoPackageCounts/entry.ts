import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Corrige el conteo de paquetes que quedó inflado en cajas y bultos ya creados.
//
// Recalcula cargo_package_count (el número que usan la ficha, la guía de despacho y la
// facturación) con el conteo real: en una caja consolidada solo los paquetes registrados
// dentro; en un bulto suelto los registrados más los códigos escaneados que no son
// etiquetas de bulto (-B## / -C##). Además limpia esas etiquetas de unidades ya
// fusionadas que quedaron mezcladas en unregistered_codes y package_trackings, y
// deduplica. No crea ni suelta paquetes, no borra absorbed_bultos y respeta un conteo
// ya corregido a mano cuando es igual o menor al real.

const text = (value: any) => String(value ?? '').trim();
const isBultoLabel = (code: any) => /-[BC]\d+$/i.test(text(code));
const cleanCodes = (list: any) => [...new Set(
  (Array.isArray(list) ? list : []).map(text).filter((code) => code && !isBultoLabel(code))
)];

// Mismos criterios que realPackageCount del frontend.
function realPackageCount(bulto: any) {
  const ids = (Array.isArray(bulto?.package_ids) ? bulto.package_ids : [])
    .filter((id: any) => id && !String(id).startsWith('local_'));
  if (bulto?.is_caja) return ids.length;
  return ids.length + cleanCodes(bulto?.unregistered_codes).length;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Solo administradores' }, { status: 403 });
    }

    let revisados = 0;
    const changes: any[] = [];
    let cursor: string | undefined = undefined;

    while (true) {
      const page: any = await base44.asServiceRole.entities.Bulto
        .list({ sort: '-created_date', limit: 500, ...(cursor ? { cursor } : {}) })
        .catch(() => null);
      const rows: any[] = page?.items || [];
      if (!rows.length) break;

      for (const bulto of rows) {
        revisados++;
        const packageTrackings = cleanCodes(bulto.package_trackings);
        const unregisteredCodes = cleanCodes(bulto.unregistered_codes);
        const patch: any = {};

        if (packageTrackings.length !== (Array.isArray(bulto.package_trackings) ? bulto.package_trackings.length : 0)) {
          patch.package_trackings = packageTrackings;
        }
        if (unregisteredCodes.length !== (Array.isArray(bulto.unregistered_codes) ? bulto.unregistered_codes.length : 0)) {
          patch.unregistered_codes = unregisteredCodes;
        }

        const real = realPackageCount({ ...bulto, unregistered_codes: unregisteredCodes });
        if (Number(bulto.cargo_package_count) > real) patch.cargo_package_count = real;

        if (Object.keys(patch).length) changes.push({ id: bulto.id, ...patch });
      }

      if (!page?.has_more || !page?.next_cursor) break;
      cursor = page.next_cursor;
    }

    let corregidos = 0;
    for (let i = 0; i < changes.length; i += 500) {
      const slice = changes.slice(i, i + 500);
      await base44.asServiceRole.entities.Bulto.bulkUpdate(slice);
      corregidos += slice.length;
    }

    return Response.json({ success: true, revisados, corregidos });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}