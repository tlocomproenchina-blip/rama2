import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { describeBultoForAbsorption } from '../../shared/bultoAbsorption.ts';

// Combinar unidades ya registradas desde el historial.
//
// El almacén busca al cliente en el historial, ve todos sus bultos y cajas, elige varios y
// los combina en una sola unidad nueva con su propio código ({shipping_mark}-C## o -B##).
// El contenido de las unidades elegidas pasa a la nueva y las originales se eliminan,
// dejando constancia de lo combinado en absorbed_bultos.
const COUNTER_KEY = 'main';
const text = (value: any) => String(value ?? '').trim();
const uniq = (list: any[]) => [...new Set((list || []).map(text).filter(Boolean))];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Siguiente número de etiqueta de bulto/caja del almacén (un solo número).
async function nextBultoNumber(base44: any) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const rows = await base44.asServiceRole.entities.BultoNumberCounter
      .filter({ config_key: COUNTER_KEY }, '-updated_date', 1)
      .catch(() => []);
    let counter = rows?.[0] || null;

    if (!counter) {
      const shared = await base44.asServiceRole.entities.ShippingMarkCounter
        .filter({ config_key: COUNTER_KEY }, '-updated_date', 1)
        .catch(() => []);
      const seed = Number(shared?.[0]?.last_number);
      try {
        counter = await base44.asServiceRole.entities.BultoNumberCounter.create({
          config_key: COUNTER_KEY,
          last_number: Number.isFinite(seed) ? seed : 49999,
        });
      } catch (_) {
        await sleep(60);
        continue;
      }
    }

    const oldValue = Number(counter.last_number) || 0;
    const result = await base44.asServiceRole.entities.BultoNumberCounter.updateMany(
      { config_key: COUNTER_KEY, last_number: oldValue },
      { $inc: { last_number: 1 } }
    );
    if (result?.updated >= 1) return oldValue + 1;
    await sleep(60);
  }
  return null;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores pueden combinar unidades' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const ids = uniq(body.bulto_ids || []);
    const kind = text(body.kind) === 'bulto' ? 'bulto' : 'caja';
    if (ids.length < 2) {
      return Response.json({ error: 'Selecciona al menos dos unidades para combinar.' }, { status: 400 });
    }

    const sources: any[] = [];
    for (const id of ids) {
      const bulto = await base44.asServiceRole.entities.Bulto.get(id).catch(() => null);
      if (!bulto?.id) {
        return Response.json({ error: 'Una de las unidades seleccionadas ya no existe.' }, { status: 400 });
      }
      sources.push(bulto);
    }

    const clientEmail = text(sources[0].client_email);
    if (sources.some((s) => text(s.client_email).toLowerCase() !== clientEmail.toLowerCase())) {
      return Response.json({ error: 'Solo se pueden combinar unidades del mismo cliente.' }, { status: 400 });
    }
    const blocked = sources.find((s) => s.billed_invoice_id || text(s.status) === 'despachado');
    if (blocked) {
      return Response.json({
        error: `La unidad ${text(blocked.label_code)} ya está facturada o despachada y no se puede combinar.`,
      }, { status: 400 });
    }

    const number = await nextBultoNumber(base44);
    if (!number) {
      return Response.json({ error: 'No se pudo reservar un número de etiqueta. Intenta de nuevo.' }, { status: 500 });
    }

    const shippingMark = text(sources[0].shipping_mark) || text(sources[0].client_snapshot?.shipping_mark);
    const labelCode = `${shippingMark}-${kind === 'bulto' ? 'B' : 'C'}${number}`;

    // Paquetes y trackings se mueven emparejados: el tracking de cada paquete se toma por
    // su posición, así que se conserva el orden de cada unidad de origen.
    const packageIds: string[] = [];
    const packageTrackings: string[] = [];
    for (const source of sources) {
      const srcIds = source.package_ids || [];
      const srcCodes = source.package_trackings || [];
      srcIds.forEach((id: string, index: number) => {
        const value = text(id);
        if (!value || packageIds.includes(value)) return;
        packageIds.push(value);
        packageTrackings.push(text(srcCodes[index]));
      });
      for (const code of srcCodes.slice(srcIds.length)) {
        const value = text(code);
        if (value && !packageTrackings.includes(value)) packageTrackings.push(value);
      }
    }

    const now = new Date().toISOString();
    const absorbedBultos: any[] = [];
    for (const source of sources) {
      absorbedBultos.push(...(source.absorbed_bultos || []));
      const detail = await describeBultoForAbsorption(base44, source);
      absorbedBultos.push({
        ...detail,
        trackings: uniq(source.package_trackings || []),
        absorbed_at: now,
        absorbed_by: user.email || '',
      });
    }

    const sealed = sources.every((s) => text(s.status) !== 'activo');
    const newBulto = await base44.asServiceRole.entities.Bulto.create({
      label_code: labelCode,
      is_caja: kind === 'caja',
      client_email: clientEmail,
      shipping_mark: shippingMark,
      bulto_number: number,
      total_bultos: number,
      package_ids: packageIds,
      package_trackings: packageTrackings,
      unregistered_codes: uniq(sources.flatMap((s) => s.unregistered_codes || [])),
      cbm_order_numbers: uniq(sources.flatMap((s) => s.cbm_order_numbers || [])),
      absorbed_bultos: absorbedBultos,
      client_snapshot: sources[0].client_snapshot || {},
      warehouse_id: sources[0].warehouse_id || '',
      status: sealed ? 'en_almacen_ve' : 'cerrado',
      print_count: 0,
      created_by: user.email || '',
    });

    // El contenido ya vive en la unidad nueva: se eliminan las originales.
    const failed: string[] = [];
    let deleted = 0;
    for (const source of sources) {
      try {
        await base44.asServiceRole.entities.Bulto.delete(source.id);
        deleted += 1;
      } catch (_) {
        failed.push(text(source.label_code) || source.id);
      }
    }

    return Response.json({ success: true, bulto: newBulto, deleted, failed });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'No se pudieron combinar las unidades' }, { status: 500 });
  }
}