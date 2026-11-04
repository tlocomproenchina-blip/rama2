import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Guarda en línea una caja o bulto que se está armando en la Mesa de empaque y une su
// contenido con lo que otros operadores ya guardaron (unión automática):
// - Lo que el dispositivo agregó se suma; lo que quitó a propósito queda como "quitado"
//   para que la unión no lo vuelva a meter desde otro equipo.
// - Una unidad cerrada o eliminada no se reabre.
const LIST_FIELDS = [
  'package_ids', 'package_trackings', 'unregistered_codes',
  'absorbed_codes', 'combined_codes', 'cbm_order_numbers',
];
const text = (v: any) => String(v ?? '').trim();
const uniq = (list: any) => [...new Set((Array.isArray(list) ? list : []).map(text).filter(Boolean))];

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo personal del almacén' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const unit = body.unit || {};
    const added = body.added || {};
    const removed = body.removed || {};
    const status = ['abierta', 'cerrada', 'eliminada'].includes(body.status) ? body.status : 'abierta';
    const unitId = text(unit.unit_id);
    const labelCode = text(unit.label_code);
    if (!unitId || !labelCode) return Response.json({ error: 'Falta la unidad' }, { status: 400 });

    const entity = base44.asServiceRole.entities.OpenPackUnit;
    const res: any = await entity.filter({ unit_id: unitId }, '-updated_date', 1);
    const rows = Array.isArray(res) ? res : res?.items || [];
    const existing = rows[0] || null;

    if (existing && existing.status !== 'abierta') {
      return Response.json({ record: existing });
    }

    const tombstones: Record<string, string[]> = { ...(existing?.tombstones || {}) };
    const data: Record<string, any> = {};
    for (const f of LIST_FIELDS) {
      const addedF = uniq(added[f]);
      const t = new Set(uniq(tombstones[f]).filter((x) => !addedF.includes(x)));
      uniq(removed[f]).forEach((x) => t.add(x));
      data[f] = uniq([...(existing?.[f] || []), ...(unit[f] || []), ...addedF]).filter((x) => !t.has(x));
      tombstones[f] = [...t].slice(-500);
    }

    const absorbedSet = new Set(data.absorbed_codes);
    const byCode = new Map();
    for (const b of [...(existing?.absorbed_bultos || []), ...(unit.absorbed_bultos || [])]) {
      const code = text(b?.label_code);
      if (code && absorbedSet.has(code)) byCode.set(code, b);
    }

    Object.assign(data, {
      label_code: labelCode,
      is_caja: !!unit.is_caja,
      client_email: text(unit.client_email),
      shipping_mark: text(unit.shipping_mark),
      bulto_number: Number(unit.bulto_number) || 0,
      total_bultos: Number(unit.total_bultos) || 0,
      client_snapshot: unit.client_snapshot || existing?.client_snapshot || {},
      absorbed_bultos: [...byCode.values()],
      tombstones,
      status,
      updated_by: user.email,
      last_device_id: text(body.device_id),
    });

    const record = existing
      ? await entity.update(existing.id, data)
      : await entity.create({ unit_id: unitId, created_by_email: text(unit.created_by) || user.email, ...data });

    return Response.json({ record: { ...(existing || {}), ...data, ...(record || {}), unit_id: unitId } });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}