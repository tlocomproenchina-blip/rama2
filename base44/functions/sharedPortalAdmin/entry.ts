import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  escapeRegex,
  isoOrNull,
  randomPortalToken,
  sha256Hex,
  strList,
  tokenHint,
} from '../../shared/sharedPortal.ts';
import { connectionKeyOf, connectionLabel, listWholesalerConnections } from '../../shared/wholesalerCore.ts';
import { emailKeyOf, markKeyOf } from '../../shared/wholesalerBilling.ts';

// Administración del Portal de Consulta Compartido (solo administradores):
// generar, limitar el alcance, vencer, revocar y regenerar el enlace, además de
// revisar quién lo abrió y qué se exportó.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || 'list');
    const Link = base44.asServiceRole.entities.SharedPortalLink;
    const Log = base44.asServiceRole.entities.SharedPortalAccessLog;

    if (action === 'list') {
      const [linksPage, logsPage, connections] = await Promise.all([
        Link.filter({}, { sort: '-created_date', limit: 50 }),
        Log.filter({}, { sort: '-event_date', limit: 80 }),
        listWholesalerConnections(base44),
      ]);
      return Response.json({
        ok: true,
        links: linksPage?.items || [],
        logs: logsPage?.items || [],
        wholesalers: (connections || []).map((c: any) => ({ key: connectionKeyOf(c), name: connectionLabel(c) })),
      });
    }

    if (action === 'options') {
      const q = String(body?.q || '').trim();
      const connections = await listWholesalerConnections(base44);
      let clients: any[] = [];
      if (q) {
        const pattern = escapeRegex(q);
        const page = await base44.asServiceRole.entities.WholesalerClient.filter(
          {
            $or: [
              { email: { $regex: pattern, $options: 'i' } },
              { full_name: { $regex: pattern, $options: 'i' } },
              { shipping_mark: { $regex: pattern, $options: 'i' } },
            ],
          },
          { sort: '-fetched_date', limit: 25 }
        );
        clients = (page?.items || []).map((row: any) => ({
          email: emailKeyOf(row.email),
          full_name: String(row.full_name || '').trim(),
          shipping_mark: String(row.shipping_mark || '').trim(),
          wholesaler_key: connectionKeyOf({ config_key: row.wholesaler_key }),
          wholesaler_name: String(row.wholesaler_name || '').trim(),
        }));
      }
      return Response.json({
        ok: true,
        clients,
        wholesalers: (connections || []).map((c: any) => ({ key: connectionKeyOf(c), name: connectionLabel(c) })),
      });
    }

    if (action === 'activity') {
      const page = await Log.filter({ link_id: String(body?.link_id || '') }, { sort: '-event_date', limit: 100 });
      return Response.json({ ok: true, logs: page?.items || [] });
    }

    if (action === 'create') {
      const label = String(body?.label || '').trim();
      if (!label) return Response.json({ error: 'Ponle un nombre al enlace para reconocerlo' }, { status: 400 });
      const token = randomPortalToken();
      const code = String(body?.code || '').trim();
      const created = await Link.create({
        label,
        token_hash: await sha256Hex(token),
        token_hint: tokenHint(token),
        scope_mode: body?.scope_mode === 'limitado' ? 'limitado' : 'global',
        scope_wholesaler_keys: strList(body?.scope_wholesaler_keys, 50),
        scope_wholesaler_names: strList(body?.scope_wholesaler_names, 50),
        scope_client_emails: strList(body?.scope_client_emails, 500).map(emailKeyOf).filter(Boolean),
        scope_shipping_marks: strList(body?.scope_shipping_marks, 500).map(markKeyOf).filter(Boolean),
        access_code_set: !!code,
        access_code_hash: code ? await sha256Hex(code) : '',
        expires_at: isoOrNull(body?.expires_at),
        active: true,
        created_by: String(user.email || user.id || ''),
        notes: String(body?.notes || '').trim().slice(0, 1000),
      });
      return Response.json({ ok: true, token, link: created });
    }

    const id = String(body?.id || '').trim();
    if (!id) return Response.json({ error: 'Falta el enlace' }, { status: 400 });

    if (action === 'update') {
      const clearCode = body?.clear_code === true;
      const code = String(body?.code || '').trim();
      const patch: any = {
        label: String(body?.label || '').trim(),
        notes: String(body?.notes || '').trim().slice(0, 1000),
        expires_at: isoOrNull(body?.expires_at),
      };
      if (body?.scope_mode) {
        patch.scope_mode = body.scope_mode === 'limitado' ? 'limitado' : 'global';
        patch.scope_wholesaler_keys = strList(body?.scope_wholesaler_keys, 50);
        patch.scope_wholesaler_names = strList(body?.scope_wholesaler_names, 50);
        patch.scope_client_emails = strList(body?.scope_client_emails, 500).map(emailKeyOf).filter(Boolean);
        patch.scope_shipping_marks = strList(body?.scope_shipping_marks, 500).map(markKeyOf).filter(Boolean);
      }
      if (clearCode) {
        patch.access_code_set = false;
        patch.access_code_hash = '';
      } else if (code) {
        patch.access_code_set = true;
        patch.access_code_hash = await sha256Hex(code);
      }
      const updated = await Link.update(id, patch);
      return Response.json({ ok: true, link: updated });
    }

    if (action === 'revoke') {
      const updated = await Link.update(id, {
        active: false,
        revoked_date: new Date().toISOString(),
        revoked_by: String(user.email || user.id || ''),
      });
      return Response.json({ ok: true, link: updated });
    }

    if (action === 'reactivate') {
      const updated = await Link.update(id, { active: true, revoked_date: '', revoked_by: '' });
      return Response.json({ ok: true, link: updated });
    }

    if (action === 'regenerate') {
      const token = randomPortalToken();
      const updated = await Link.update(id, {
        token_hash: await sha256Hex(token),
        token_hint: tokenHint(token),
        active: true,
        revoked_date: '',
        revoked_by: '',
        access_count: 0,
        export_count: 0,
        last_access_date: '',
        last_export_date: '',
        last_export_rows: 0,
      });
      return Response.json({ ok: true, token, link: updated });
    }

    if (action === 'delete') {
      await Link.delete(id);
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'No se pudo completar la acción' }, { status: 500 });
  }
}