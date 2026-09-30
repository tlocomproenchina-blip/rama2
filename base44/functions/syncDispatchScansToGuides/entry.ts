import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { appendScanToDispatchGuide, normCode } from '../../shared/dispatchGuideAppend.ts';

// Sincroniza con las guías de despacho todo lo escaneado en Despacho por Escaneo
// que todavía no pertenece a ninguna guía (incluye el historial escaneado antes de
// que existiera la creación automática). Reutiliza la misma lógica del escaneo en
// vivo, así el resultado es idéntico al de una guía automática.
// El frontend repite la llamada hasta que la respuesta indique que no queda nada
// por archivar (done), pasando los códigos que no se pudieron asociar para que no
// vuelvan a ocupar el lote; el reintento los vuelve a intentar desde cero.
const DISPATCH_RESULTS = ['dispatched', 'already_dispatched'];
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;
const MAX_SKIP = 500;

const REASON_LABEL: any = {
  sin_cliente: 'Sin cliente ni shipping mark',
  no_es_bulto: 'El código no es de bulto',
};

const reasonOf = (result: any) =>
  REASON_LABEL[result?.skipped] || String(result?.error || 'No se pudo asociar a una guía');

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const logs = base44.asServiceRole.entities.DispatchScanLog;

    // Escaneos de bulto que todavía no forman parte de ninguna guía: el mismo
    // criterio que usa la lista de pendientes de Emitir guía.
    const pendingFilter: any = {
      scan_type: 'bulto',
      result: { $in: DISPATCH_RESULTS },
      guide_id: null,
    };

    if (body.count_only) {
      const pending = await logs.count(pendingFilter);
      return Response.json({ ok: true, pending: Number(pending) || 0 });
    }

    const skipCodes = [
      ...new Set(
        (Array.isArray(body.skip_codes) ? body.skip_codes : []).map((c: any) => normCode(c)).filter(Boolean)
      ),
    ].slice(0, MAX_SKIP);
    const limit = Math.min(Math.max(Number(body.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);

    const pendingBefore = Number(await logs.count(pendingFilter)) || 0;
    const fetchFilter: any = skipCodes.length
      ? { ...pendingFilter, bulto_label_code: { $nin: skipCodes } }
      : pendingFilter;

    // Del más antiguo al más nuevo: los correlativos salen en orden de escaneo.
    const raw = await logs.filter(fetchFilter, 'created_date', limit);
    const rows: any[] = Array.isArray(raw) ? raw : [];

    // Un bulto puede tener varios escaneos: se archiva una sola vez, con la fecha
    // del escaneo más antiguo y los datos de cliente que sí quedaron registrados.
    const byCode = new Map<string, any>();
    rows.forEach((log) => {
      const code = normCode(log?.bulto_label_code || log?.scanned_code);
      if (!code) return;
      const date = log?.scanned_at || log?.created_date || '';
      const current: any = byCode.get(code);
      if (!current) {
        byCode.set(code, {
          code,
          date,
          client_email: String(log?.client_email || '').trim(),
          client_name: String(log?.client_name || '').trim(),
          shipping_mark: String(log?.shipping_mark || '').trim(),
          package_count: Number(log?.package_count) || 0,
          scanned_by: String(log?.scanned_by || '').trim(),
        });
        return;
      }
      if (date && (!current.date || date < current.date)) current.date = date;
      if (!current.client_email && log?.client_email) current.client_email = String(log.client_email).trim();
      if (!current.client_name && log?.client_name) current.client_name = String(log.client_name).trim();
      if (!current.shipping_mark && log?.shipping_mark) current.shipping_mark = String(log.shipping_mark).trim();
      if (!current.scanned_by && log?.scanned_by) current.scanned_by = String(log.scanned_by).trim();
      current.package_count = Math.max(current.package_count, Number(log?.package_count) || 0);
    });

    const createdGuides = new Set<string>();
    const touchedGuides = new Set<string>();
    const skipped: any[] = [];
    let updated = 0;
    let unchanged = 0;

    for (const row of byCode.values()) {
      let result: any = null;
      try {
        result = await appendScanToDispatchGuide(base44, {
          label_code: row.code,
          client_email: row.client_email,
          client_name: row.client_name,
          shipping_mark: row.shipping_mark,
          package_count: row.package_count,
          scanned_at: row.date,
          scanned_by: row.scanned_by || user.email,
          scanned_by_name: user.full_name || '',
        });
      } catch (error: any) {
        result = { error: error?.message || 'Error al archivar el bulto' };
      }

      if (!result?.ok) {
        skipped.push({ code: row.code, reason: reasonOf(result) });
        continue;
      }
      if (result.created) createdGuides.add(result.guide_id);
      else if (result.already) unchanged += 1;
      else {
        touchedGuides.add(result.guide_id);
        updated += 1;
      }
    }

    const pendingAfter = Number(await logs.count(pendingFilter)) || 0;
    const archived = Math.max(pendingBefore - pendingAfter, 0);

    return Response.json({
      ok: true,
      pending: pendingAfter,
      pending_before: pendingBefore,
      attempted: byCode.size,
      created: createdGuides.size,
      guides_touched: touchedGuides.size,
      updated,
      unchanged,
      skipped,
      archived,
      // Sin nada archivado en el lote no queda trabajo por hacer: lo que siga
      // pendiente es lo que no se pudo asociar (cliente o shipping mark).
      done: archived === 0,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}