import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { generateAppKey, hashAppKey, keyLabel, slugify } from '../../shared/integratedApps.ts';

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
    key_prefix: app.key_prefix || '',
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

async function countByScope(base44, entity, appId) {
  const rows = await base44.asServiceRole.entities[entity].filter({ origin_app_id: appId }, '-created_date', COUNT_LIMIT);
  const list = rows || [];
  return { count: Math.min(list.length, COUNT_CAP), exceeded: list.length > COUNT_CAP };
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
      const updated = await base44.asServiceRole.entities.IntegratedApp.update(existing.id, {
        key_hash: await hashAppKey(rawKey),
        key_prefix: keyLabel(rawKey)
      });
      return Response.json({ ok: true, app: publicApp(updated), key: rawKey });
    }

    if (action === 'toggle') {
      const active = body?.active !== false;
      const updated = await base44.asServiceRole.entities.IntegratedApp.update(existing.id, { active });
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