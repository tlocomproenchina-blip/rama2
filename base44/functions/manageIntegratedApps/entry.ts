import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { generateAppKey, hashAppKey, keyLabel, slugify, isTestEmail } from '../../shared/integratedApps.ts';

const COUNT_LIMIT = 201;
const COUNT_CAP = 200;

function publicApp(app) {
  return {
    id: app.id,
    name: app.name,
    slug: app.slug,
    contact_email: app.contact_email || '',
    notes: app.notes || '',
    active: app.active !== false,
    last_seen: app.last_seen || null,
    last_action: app.last_action || '',
    call_count: Number(app.call_count) || 0,
    report_date: app.report_date || null,
    report_configured: app.report_configured !== false,
    report_missing: Array.isArray(app.report_missing) ? app.report_missing : [],
    report_pending: Number(app.report_pending) || 0,
    report_error: app.report_error || '',
    report_error_date: app.report_error_date || null,
    test_date: app.test_date || null,
    test_ok: app.test_ok === true,
    test_steps: Array.isArray(app.test_steps) ? app.test_steps : [],
    test_leftovers: Array.isArray(app.test_leftovers) ? app.test_leftovers : [],
    test_requested_date: app.test_requested_date || null,
    test_requested_by: app.test_requested_by || '',
    rejected_count: Number(app.rejected_count) || 0,
    rejected_last_date: app.rejected_last_date || null,
    rejected_last_reason: app.rejected_last_reason || '',
    rejected_last_action: app.rejected_last_action || '',
    key_prefix: app.key_prefix || '',
    rate_cbm_regular: Number(app.rate_cbm_regular) || 0,
    rate_cbm_high_risk: Number(app.rate_cbm_high_risk) || 0,
    special_cbm_rates: Array.isArray(app.special_cbm_rates) ? app.special_cbm_rates : [],
    shipping_mark_prefix: app.shipping_mark_prefix || '',
    created_by: app.created_by || '',
    created_date: app.created_date || null
  };
}

async function uniqueSlug(base44, base) {
  let candidate = base;
  for (let i = 2; i <= 20; i += 1) {
    const found = await base44.asServiceRole.entities.IntegratedApp.filter({ slug: candidate }, '-created_date', 1);
    if (!found?.length) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

// Los registros de la prueba de conexión (correo reservado) no cuentan como reales.
async function countByScope(base44, entity, appId) {
  const rows = await base44.asServiceRole.entities[entity].filter({ origin_app_id: appId }, '-created_date', COUNT_LIMIT);
  const list = (rows || []).filter((row) => !isTestEmail(row?.email || row?.client_email));
  return { count: Math.min(list.length, COUNT_CAP), exceeded: list.length > COUNT_CAP };
}

// Borra los datos de prueba que hayan quedado sin limpiar en TLEC CARGO.
const TEST_TARGETS = [
  ['IntegratedClient', 'client_email'],
  ['Invoice', 'client_email'],
  ['InvoicePayment', 'client_email'],
  ['Package', 'client_email']
];

async function purgeTestData(base44, appId) {
  let removed = 0;
  for (const [entity, field] of TEST_TARGETS) {
    const rows = await base44.asServiceRole.entities[entity].filter({ origin_app_id: appId }, '-created_date', COUNT_LIMIT);
    for (const row of rows || []) {
      if (!isTestEmail(row[field])) continue;
      try {
        await base44.asServiceRole.entities[entity].delete(row.id);
        removed += 1;
      } catch (_) {
        // si un registro no se puede borrar, se sigue con el resto
      }
    }
  }
  return removed;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || 'list').trim().toLowerCase();

    if (action === 'list') {
      const apps = await base44.asServiceRole.entities.IntegratedApp.list('-created_date', 100);
      return Response.json({ ok: true, apps: (apps || []).map(publicApp) });
    }

    if (action === 'stats') {
      const appId = String(body?.app_id || '').trim();
      if (!appId) return Response.json({ ok: false, error: 'Falta app_id' }, { status: 400 });
      const [clients, accountless, prealerts, invoices, payments] = await Promise.all([
        countByScope(base44, 'User', appId),
        countByScope(base44, 'IntegratedClient', appId),
        countByScope(base44, 'Package', appId),
        countByScope(base44, 'Invoice', appId),
        countByScope(base44, 'InvoicePayment', appId)
      ]);
      return Response.json({
        ok: true,
        stats: {
          clients: { count: clients.count + accountless.count, exceeded: clients.exceeded || accountless.exceeded },
          prealerts,
          invoices,
          payments,
          total: clients.count + accountless.count + prealerts.count + invoices.count + payments.count
        }
      });
    }

    if (action === 'create') {
      const name = String(body?.name || '').trim();
      if (!name) return Response.json({ ok: false, error: 'El nombre de la app integrada es obligatorio' }, { status: 400 });

      const slug = await uniqueSlug(base44, slugify(name, 'copia'));
      const rawKey = generateAppKey();
      const created = await base44.asServiceRole.entities.IntegratedApp.create({
        name,
        slug,
        contact_email: String(body?.contact_email || '').trim(),
        notes: String(body?.notes || '').trim(),
        description: String(body?.description || '').trim(),
        key_hash: await hashAppKey(rawKey),
        key_prefix: keyLabel(rawKey),
        active: true,
        call_count: 0,
        created_by: user.email
      });
      return Response.json({ ok: true, app: publicApp(created), key: rawKey });
    }

    const appId = String(body?.app_id || '').trim();
    if (!appId) return Response.json({ ok: false, error: 'Falta app_id' }, { status: 400 });
    const apps = await base44.asServiceRole.entities.IntegratedApp.filter({ id: appId }, '-created_date', 1);
    const existing = apps?.[0];
    if (!existing) return Response.json({ ok: false, error: 'La app integrada no existe' }, { status: 404 });

    if (action === 'rotate') {
      const rawKey = generateAppKey();
      const history = Array.isArray(existing.key_prefixes) ? existing.key_prefixes : [];
      const updated = await base44.asServiceRole.entities.IntegratedApp.update(existing.id, {
        key_hash: await hashAppKey(rawKey),
        key_prefix: keyLabel(rawKey),
        key_prefixes: existing.key_prefix ? [...history, existing.key_prefix].slice(-5) : history
      });
      return Response.json({ ok: true, app: publicApp(updated), key: rawKey });
    }

    if (action === 'toggle') {
      const active = body?.active !== false;
      const updated = await base44.asServiceRole.entities.IntegratedApp.update(existing.id, { active });
      return Response.json({ ok: true, app: publicApp(updated) });
    }

    if (action === 'request_test') {
      const updated = await base44.asServiceRole.entities.IntegratedApp.update(existing.id, {
        test_requested_date: new Date().toISOString(),
        test_requested_by: user.email
      });
      return Response.json({ ok: true, app: publicApp(updated) });
    }

    if (action === 'cleanup_test') {
      const removed = await purgeTestData(base44, existing.id);
      const updated = await base44.asServiceRole.entities.IntegratedApp.update(existing.id, { test_leftovers: [] });
      return Response.json({ ok: true, removed, app: publicApp(updated) });
    }

    if (action === 'set_tariff') {
      const rateRegular = Number(String(body?.rate_cbm_regular ?? 0).replace(',', '.'));
      const rateHigh = Number(String(body?.rate_cbm_high_risk ?? 0).replace(',', '.'));
      if (!Number.isFinite(rateRegular) || rateRegular < 0 || !Number.isFinite(rateHigh) || rateHigh < 0) {
        return Response.json({ ok: false, error: 'Las tarifas por CBM deben ser números iguales o mayores a 0' }, { status: 400 });
      }
      const ranges = Array.isArray(body?.special_cbm_rates) ? body.special_cbm_rates.slice(0, 40) : [];
      const cleanRanges = ranges
        .map((row) => ({
          min_cbm: Number(row?.min_cbm) || 0,
          max_cbm: Number(row?.max_cbm) || 0,
          rate_regular: Number(row?.rate_regular) || 0,
          rate_high_risk: Number(row?.rate_high_risk) || 0
        }))
        .sort((a, b) => a.min_cbm - b.min_cbm);
      const updated = await base44.asServiceRole.entities.IntegratedApp.update(existing.id, {
        rate_cbm_regular: Math.round(rateRegular * 10000) / 10000,
        rate_cbm_high_risk: Math.round(rateHigh * 10000) / 10000,
        special_cbm_rates: cleanRanges,
        shipping_mark_prefix: String(body?.shipping_mark_prefix || '').trim().slice(0, 40)
      });
      return Response.json({ ok: true, app: publicApp(updated) });
    }

    if (action === 'update') {
      const changes = {};
      if (body?.name !== undefined) changes.name = String(body.name).trim();
      if (body?.contact_email !== undefined) changes.contact_email = String(body.contact_email).trim();
      if (body?.notes !== undefined) changes.notes = String(body.notes).trim();
      if (Object.keys(changes).length === 0) {
        return Response.json({ ok: false, error: 'No hay cambios para guardar' }, { status: 400 });
      }
      const updated = await base44.asServiceRole.entities.IntegratedApp.update(existing.id, changes);
      return Response.json({ ok: true, app: publicApp(updated) });
    }

    if (action === 'delete') {
      await base44.asServiceRole.entities.IntegratedApp.delete(existing.id);
      return Response.json({ ok: true, deleted: existing.id });
    }

    return Response.json({ ok: false, error: `Acción no soportada: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || 'Error inesperado' }, { status: 500 });
  }
}