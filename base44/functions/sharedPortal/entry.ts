import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  PORTAL_EXPORT_PAGE,
  PORTAL_MAX_EXPORT,
  PORTAL_PAGE_SIZE,
  andFilters,
  codeMatches,
  loadPortalLink,
  loadWholesalerIndex,
  logPortalEvent,
  portalErrorText,
  portalFiltersSummary,
  portalPage,
  portalQuery,
  portalRow,
  portalShortFormat,
  portalWholesalerOptions,
  publicLink,
  touchPortalLink,
} from '../../shared/sharedPortal.ts';

// Consulta pública del Portal de Consulta Compartido: solo lectura, sin sesión
// de la app. Valida el enlace, su vencimiento y su código de acceso en el
// servidor en cada consulta y en cada exportación.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || 'query');

    const found = await loadPortalLink(base44, body?.token);
    if (found.ok === false) {
      if (found.link) {
        await logPortalEvent(base44, found.link, {
          event_type: 'rechazo',
          result: found.reason,
          detail: 'Enlace revocado o vencido',
        });
      }
      return Response.json({ error: portalErrorText(found.reason), reason: found.reason }, { status: 403 });
    }

    const link = found.link;
    const code = await codeMatches(link, body?.code);
    if (code.ok === false) {
      await logPortalEvent(base44, link, {
        event_type: 'rechazo',
        result: code.reason,
        detail: code.reason === 'codigo_requerido' ? 'Consultó sin código de acceso' : 'Código de acceso incorrecto',
      });
      return Response.json(
        { error: code.reason === 'codigo_requerido' ? 'Este enlace pide código de acceso' : 'Código de acceso incorrecto', reason: code.reason },
        { status: 403 }
      );
    }

    if (action === 'ping') {
      return Response.json({ ok: true, link: publicLink(link), generated_at: new Date().toISOString() });
    }

    const filters = body?.filters || {};
    const index = await loadWholesalerIndex(base44);
    const query = portalQuery({ link, index, filters });

    if (action === 'export') {
      const rows: any[] = [];
      let cursor: string | undefined;
      let capped = false;
      for (let i = 0; i < 200; i++) {
        const page = await portalPage(base44, query, PORTAL_EXPORT_PAGE, cursor);
        const items = (page?.items || []) as any[];
        rows.push(...items.map((pkg) => portalRow(pkg, index)));
        if (rows.length >= PORTAL_MAX_EXPORT) {
          capped = true;
          break;
        }
        if (!page?.has_more || !page?.next_cursor) break;
        cursor = page.next_cursor;
      }
      const out = rows.slice(0, PORTAL_MAX_EXPORT);
      const format = portalShortFormat(body?.format);
      await Promise.all([
        logPortalEvent(base44, link, {
          event_type: 'exportacion',
          result: capped ? 'con_tope' : 'ok',
          rows: out.length,
          format,
          filters: portalFiltersSummary(filters),
          detail: capped
            ? 'La exportación alcanzó el tope del portal: acota los filtros para bajarla completa'
            : 'Exportación de todos los resultados filtrados',
        }),
        touchPortalLink(base44, link, {
          export_count: Number(link?.export_count || 0) + 1,
          last_export_date: new Date().toISOString(),
          last_export_rows: out.length,
        }),
      ]);
      return Response.json({ ok: true, rows: out, total: out.length, capped, generated_at: new Date().toISOString() });
    }

    if (action === 'log_export') {
      const count = Math.max(0, Number(body?.row_count) || 0);
      const format = portalShortFormat(body?.format);
      await Promise.all([
        logPortalEvent(base44, link, {
          event_type: 'exportacion',
          result: 'seleccion',
          rows: count,
          format,
          filters: portalFiltersSummary(filters),
          detail: 'Exportación de los registros seleccionados',
        }),
        touchPortalLink(base44, link, {
          export_count: Number(link?.export_count || 0) + 1,
          last_export_date: new Date().toISOString(),
          last_export_rows: count,
        }),
      ]);
      return Response.json({ ok: true });
    }

    const limit = Math.min(PORTAL_PAGE_SIZE * 4, Math.max(1, Number(body?.limit) || PORTAL_PAGE_SIZE));
    const cursor = portalShortFormat(body?.cursor) ? String(body.cursor) : undefined;
    const scopeQuery = portalQuery({ link, index, filters: {} });

    const [total, recibidos, resultados, page, wholesalers] = await Promise.all([
      base44.asServiceRole.entities.Package.count(scopeQuery),
      base44.asServiceRole.entities.Package.count(andFilters(scopeQuery, { received_date: { $ne: null } })),
      Object.keys(query).length ? base44.asServiceRole.entities.Package.count(query) : Promise.resolve(null),
      portalPage(base44, query, limit, cursor),
      portalWholesalerOptions(base44, link),
    ]);

    const totalCount = Number(total) || 0;
    // Un tracking tiene fecha de recepción o no la tiene: por recibir es el resto
    // del alcance, así el portal no gasta una consulta extra en cada página.
    const porRecibir = Math.max(0, totalCount - (Number(recibidos) || 0));
    const filteredCount = resultados === null ? totalCount : Number(resultados) || 0;

    const rows = ((page?.items || []) as any[]).map((pkg) => portalRow(pkg, index));
    const next = page?.has_more && page?.next_cursor ? String(page.next_cursor) : null;

    await Promise.all([
      logPortalEvent(base44, link, {
        event_type: 'consulta',
        result: rows.length ? 'ok' : 'sin_resultados',
        rows: rows.length,
        filters: portalFiltersSummary(filters),
        detail: 'Consulta desde el portal compartido',
      }),
      touchPortalLink(base44, link, {
        access_count: Number(link?.access_count || 0) + 1,
        last_access_date: new Date().toISOString(),
      }),
    ]);

    return Response.json({
      ok: true,
      link: publicLink(link),
      stats: {
        total: totalCount,
        por_recibir: porRecibir,
        recibidos: Number(recibidos) || 0,
        resultados: filteredCount,
      },
      rows,
      pagination: { limit, returned: rows.length, has_more: !!next, next_cursor: next },
      wholesalers,
      generated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'No se pudo consultar el portal' }, { status: 500 });
  }
}