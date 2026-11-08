// Trackings ya registrados en una caja o bulto.
//
// Un tracking vive en una sola unidad: si ya figura en un bulto o caja (abierta en la
// Mesa de empaque o ya registrada), no se vuelve a meter en otra. Esta es la
// comprobación del servidor, la que manda sobre el caché de cada dispositivo.
const text = (v: any) => String(v ?? '').trim();
const up = (v: any) => text(v).toUpperCase();
const isLabelCode = (v: any) => /-[BCL]\d+$/i.test(text(v));

export type DuplicateItem = { code: string; package_id?: string };
export type DuplicateOptions = {
  excludeBultoIds?: string[];
  excludeLabels?: string[];
  excludeLocalUnitId?: string;
  excludeOpenUnitId?: string;
  includeOpen?: boolean;
};

const codesOf = (rec: any) =>
  new Set([...(rec?.package_trackings || []), ...(rec?.unregistered_codes || [])].map(up));

// Unidad dueña de cada código: [] si ninguno está registrado.
export async function findTrackingOwners(base44: any, items: DuplicateItem[], opts: DuplicateOptions = {}) {
  const list = (items || [])
    .map((i) => ({ code: text(i?.code), package_id: text(i?.package_id) }))
    .filter((i) => i.code && !isLabelCode(i.code));
  if (!list.length) return [];

  const codes = [...new Set(list.flatMap((i) => [i.code, up(i.code)]))];
  const ids = [...new Set(list.map((i) => i.package_id).filter((id) => id && !id.startsWith('local_')))];
  const or: any[] = [{ package_trackings: { $in: codes } }, { unregistered_codes: { $in: codes } }];
  if (ids.length) or.push({ package_ids: { $in: ids } });

  const [bultos, open] = await Promise.all([
    base44.asServiceRole.entities.Bulto
      .filter({ $or: or, status: { $ne: 'desarmado' } }, 'created_date', 200)
      .catch(() => []),
    opts.includeOpen === false
      ? Promise.resolve([])
      : base44.asServiceRole.entities.OpenPackUnit
          .filter({ $or: or, status: 'abierta' }, 'created_date', 100)
          .catch(() => []),
  ]);

  const exB = new Set((opts.excludeBultoIds || []).map(text));
  const exL = new Set((opts.excludeLabels || []).map(up));
  const localId = text(opts.excludeLocalUnitId);
  const openId = text(opts.excludeOpenUnitId);

  const candidates = [
    ...(bultos || [])
      .filter((b: any) => !exB.has(text(b.id)) && !exL.has(up(b.label_code)))
      .filter((b: any) => !(localId && text(b.local_unit_id) === localId))
      .map((rec: any) => ({ rec, source: 'registrada' })),
    ...(open || [])
      .filter((o: any) => !(openId && text(o.unit_id) === openId) && !exL.has(up(o.label_code)))
      .map((rec: any) => ({ rec, source: 'abierta' })),
  ];

  const owners: any[] = [];
  for (const item of list) {
    const key = up(item.code);
    const hit = candidates.find(({ rec }) =>
      codesOf(rec).has(key) || (item.package_id && (rec.package_ids || []).includes(item.package_id))
    );
    if (!hit) continue;
    owners.push({
      code: item.code,
      package_id: item.package_id,
      id: hit.rec.id,
      created_date: hit.rec.created_date,
      label_code: text(hit.rec.label_code),
      is_caja: !!hit.rec.is_caja,
      status: hit.source === 'abierta' ? 'abierta' : text(hit.rec.status),
      source: hit.source,
      unit_id: text(hit.rec.unit_id || hit.rec.local_unit_id),
      operator: text(hit.rec.created_by_email || hit.rec.created_by),
      package_ids: hit.rec.package_ids || [],
    });
  }
  return owners;
}

// Lo que se le devuelve al dispositivo para avisar el duplicado.
export const publicOwner = (o: any) => ({
  code: o.code,
  label_code: o.label_code,
  is_caja: o.is_caja,
  status: o.status,
  source: o.source,
  unit_id: o.unit_id,
  operator: o.operator,
});

// Dos bultos registrados casi al mismo tiempo con el mismo tracking: lo conserva el que
// quedó registrado primero y el más nuevo lo suelta (y se elimina si queda vacío).
export async function settleTrackingRace(base44: any, created: any, codes: string[], opts: DuplicateOptions = {}) {
  const owners = await findTrackingOwners(base44, (codes || []).map((code) => ({ code })), {
    ...opts,
    excludeBultoIds: [...(opts.excludeBultoIds || []), created.id],
    includeOpen: false,
  });
  const mine = String(created.created_date || '');
  const lost = owners.filter((o) => {
    const theirs = String(o.created_date || '');
    return theirs < mine || (theirs === mine && text(o.id) < text(created.id));
  });
  if (!lost.length) return { record: created, lost: [], deleted: false };

  const lostCodes = new Set(lost.map((o) => up(o.code)));
  const lostIds = new Set(lost.flatMap((o) => o.package_ids || []));
  const trackings = (created.package_trackings || []).filter((c: string) => !lostCodes.has(up(c)));
  if (!trackings.length) {
    await base44.asServiceRole.entities.Bulto.delete(created.id).catch(() => null);
    return { record: created, lost, deleted: true };
  }
  const patch = {
    package_trackings: trackings,
    package_ids: (created.package_ids || []).filter((id: string) => !lostIds.has(id)),
    unregistered_codes: (created.unregistered_codes || []).filter((c: string) => !lostCodes.has(up(c))),
  };
  const record = await base44.asServiceRole.entities.Bulto.update(created.id, patch);
  return { record: { ...created, ...patch, ...(record || {}) }, lost, deleted: false };
}