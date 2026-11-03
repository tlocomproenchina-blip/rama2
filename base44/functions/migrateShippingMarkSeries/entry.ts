import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { reserveShippingMarkNumber } from '../../shared/shippingMark.ts';

// Migra los Shipping Marks de la serie 50000+ (N#-TLEC-5xxxx) a la serie 5000,
// continuando desde 5011 con el contador global. Conserva el código de estado (N#)
// y actualiza el Shipping Mark en los registros del cliente. Las etiquetas ya
// impresas (label_code) y los snapshots históricos (guías, reportes) no se tocan.
// Reanudable: cada cliente queda registrado en ShippingMarkMigration.

const RE = /^(N\d+)-TLEC-(\d+)$/i;
const MIN_OLD = 50000;
const FLOOR_COUNTER = 5010; // el siguiente número asignado será 5011
const RELATED = [
  'Package', 'CbmIngreso', 'Bulto', 'Consolidation', 'ConsolidationRequest', 'DispatchOrder',
  'WholesalerClient', 'ClientTagAssignment', 'ShippingLabel', 'Quote', 'QuoteFeePayment',
  'SupportFollowUp', 'PackageEditRequest', 'EscaneoBodega',
];

const parse = (mark) => {
  const m = String(mark || '').trim().match(RE);
  return m ? { prefix: m[1].toUpperCase(), n: parseInt(m[2], 10) } : null;
};

async function loadState(sr) {
  const users = await sr.entities.User.list();
  const records = await sr.entities.ShippingMarkMigration.filter({}, 'new_number', 5000);
  const byUser = new Map(records.map((r) => [r.user_id, r]));
  const markCount = new Map();
  const taken = new Set();
  for (const u of users) {
    const p = parse(u.shipping_mark);
    if (!p) continue;
    markCount.set(u.shipping_mark, (markCount.get(u.shipping_mark) || 0) + 1);
    if (p.n < MIN_OLD) taken.add(p.n);
  }
  const candidates = users
    .map((u) => ({ u, p: parse(u.shipping_mark) }))
    .filter(({ u, p }) => p && p.n >= MIN_OLD && byUser.get(u.id)?.status !== 'migrado')
    .sort((a, b) => a.p.n - b.p.n || String(a.u.created_date).localeCompare(String(b.u.created_date)) || a.u.id.localeCompare(b.u.id));
  // Clientes cuyo usuario ya cambió pero sus registros quedaron a medias
  const unfinished = records.filter((r) => r.status !== 'migrado' && !candidates.some((c) => c.u.id === r.user_id));
  return { users, records, byUser, markCount, taken, candidates, unfinished };
}

async function ensureCounterFloor(sr) {
  const rows = await sr.entities.ShippingMarkCounter.filter({ config_key: 'main' }, '-updated_date', 1);
  const c = rows?.[0];
  if (!c) {
    await sr.entities.ShippingMarkCounter.create({ config_key: 'main', last_number: FLOOR_COUNTER });
    return FLOOR_COUNTER;
  }
  const last = Number(c.last_number) || 0;
  if (last < FLOOR_COUNTER) {
    await sr.entities.ShippingMarkCounter.updateMany({ config_key: 'main', last_number: last }, { $set: { last_number: FLOOR_COUNTER } });
    return FLOOR_COUNTER;
  }
  return last;
}

async function updateRelated(sr, oldMark, newMark, email, duplicated) {
  const counts = {};
  const errors = [];
  for (let i = 0; i < RELATED.length; i += 6) {
    const chunk = RELATED.slice(i, i + 6);
    const results = await Promise.allSettled(chunk.map(async (name) => {
      const query = duplicated ? { shipping_mark: oldMark, client_email: email } : { shipping_mark: oldMark };
      let total = 0;
      for (let round = 0; round < 50; round += 1) {
        const res = await sr.entities[name].updateMany(query, { $set: { shipping_mark: newMark } });
        total += res?.updated || 0;
        if (!res?.has_more) break;
      }
      return [name, total];
    }));
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled') { if (r.value[1]) counts[r.value[0]] = r.value[1]; }
      else errors.push(`${chunk[idx]}: ${r.reason?.message || r.reason}`);
    });
  }
  return { counts, errors };
}

async function migrateOne(sr, state, user, record, admin) {
  const oldMark = record?.old_mark || user.shipping_mark;
  const prefix = parse(oldMark)?.prefix;
  let rec = record;

  if (!rec?.new_mark) {
    let num = null;
    for (let i = 0; i < 25; i += 1) {
      const n = await reserveShippingMarkNumber({ asServiceRole: sr });
      if (!n) break;
      if (!state.taken.has(n)) { num = n; break; }
    }
    if (!num) throw new Error('No se pudo reservar un número libre en la serie 5000');
    state.taken.add(num);
    const data = {
      user_id: user.id,
      client_email: user.email,
      client_name: user.full_name || [user.first_name, user.last_name].filter(Boolean).join(' '),
      old_mark: oldMark,
      new_mark: `${prefix}-TLEC-${num}`,
      new_number: num,
      status: 'pendiente',
    };
    rec = rec ? await sr.entities.ShippingMarkMigration.update(rec.id, data) : await sr.entities.ShippingMarkMigration.create(data);
  }

  if (user.shipping_mark !== rec.new_mark) {
    await sr.entities.User.update(user.id, { shipping_mark: rec.new_mark });
  }
  const duplicated = (state.markCount.get(oldMark) || 0) > 1;
  const { counts, errors } = await updateRelated(sr, oldMark, rec.new_mark, user.email, duplicated);
  const done = {
    status: errors.length ? 'error' : 'migrado',
    related_updates: counts,
    error: errors.join(' | ') || null,
    migrated_date: new Date().toISOString(),
    migrated_by: admin.email,
  };
  await sr.entities.ShippingMarkMigration.update(rec.id, done);
  return { old_mark: oldMark, new_mark: rec.new_mark, ...done };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const admin = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (admin.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { action = 'preview', batch_size = 6 } = await req.json().catch(() => ({}));
    const sr = base44.asServiceRole;
    const state = await loadState(sr);

    if (action === 'preview') {
      const counters = await sr.entities.ShippingMarkCounter.filter({ config_key: 'main' }, '-updated_date', 1);
      const last = Math.max(Number(counters?.[0]?.last_number) || 0, FLOOR_COUNTER);
      return Response.json({
        pending: state.candidates.length + state.unfinished.length,
        migrated: state.records.filter((r) => r.status === 'migrado').length,
        errors: state.records.filter((r) => r.status === 'error').length,
        next_number: last + 1,
        sample: state.candidates.slice(0, 8).map(({ u }) => u.shipping_mark),
      });
    }

    if (action === 'list') {
      return Response.json({
        records: state.records.map((r) => ({
          old_mark: r.old_mark, new_mark: r.new_mark, status: r.status, client_email: r.client_email,
          client_name: r.client_name, error: r.error, related_updates: r.related_updates,
        })),
      });
    }

    if (action !== 'run') return Response.json({ error: 'Acción no válida' }, { status: 400 });

    await ensureCounterFloor(sr);
    const usersById = new Map(state.users.map((u) => [u.id, u]));
    const queue = [
      ...state.unfinished.map((r) => ({ user: usersById.get(r.user_id), record: r })).filter((x) => x.user),
      ...state.candidates.map(({ u }) => ({ user: u, record: state.byUser.get(u.id) || null })),
    ];
    const size = Math.min(Math.max(Number(batch_size) || 6, 1), 10);
    const processed = [];
    for (const item of queue.slice(0, size)) {
      try {
        processed.push(await migrateOne(sr, state, item.user, item.record, admin));
      } catch (err) {
        processed.push({ old_mark: item.user.shipping_mark, status: 'error', error: err.message });
      }
    }
    return Response.json({ processed, remaining: Math.max(queue.length - processed.length, 0) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}