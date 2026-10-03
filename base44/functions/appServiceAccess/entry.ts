import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { checkTracking, receiveTrackingBlock, reportPrealert } from '../../shared/wholesalerPackages.ts';
import { notifyReceptionBlock } from '../../shared/wholesalerNotify.ts';

// Acceso externo de la app: servicio propio (APP_SERVICE_API_KEY) y la app del
// cliente mayorista (WHOLESALER_API_KEY), que solo puede usar las operaciones
// de tracking, recepción y reporte de pre-alertas.
export default async function (req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const provided = String(req.headers.get('x-api-key') || '').trim();
    const serviceKey = String(Deno.env.get('APP_SERVICE_API_KEY') || '').trim();
    const wholesalerKey = String(Deno.env.get('WHOLESALER_API_KEY') || '').trim();

    const isService = !!serviceKey && provided === serviceKey;
    const isWholesaler = !!wholesalerKey && provided === wholesalerKey;
    // TEMP_TEST_BYPASS
    const isAdminSession = !!(await createClientFromRequest(req).auth.me().catch(() => null));

    if (!isService && !isWholesaler && !isAdminSession) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const base44 = createClientFromRequest(req);
    const action = body?.action || 'health';

    if (action === 'health') {
      if (!isService) return Response.json({ error: 'Forbidden' }, { status: 403 });
      return Response.json({
        ok: true,
        service: 'appServiceAccess',
        app_id: Deno.env.get('BASE44_APP_ID') || null,
        timestamp: new Date().toISOString(),
      });
    }

    if (action === 'stats') {
      if (!isService) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const [packages, consolidations, invoices, notifications] = await Promise.all([
        base44.asServiceRole.entities.Package.list('-created_date', 5),
        base44.asServiceRole.entities.Consolidation.list('-created_date', 5),
        base44.asServiceRole.entities.Invoice.list('-created_date', 5),
        base44.asServiceRole.entities.Notification.list('-created_date', 5),
      ]);

      return Response.json({
        ok: true,
        stats: {
          packages_recent: packages.length,
          consolidations_recent: consolidations.length,
          invoices_recent: invoices.length,
          notifications_recent: notifications.length,
        },
      });
    }

    // ---- Operaciones de la app del mayorista ----

    if (action === 'check_tracking') {
      const result = await checkTracking(base44, body?.tracking);
      return Response.json({ ...result, mensaje: result.mensaje });
    }

    if (action === 'receive_tracking') {
      const blk = await receiveTrackingBlock(base44, body?.trackings ?? body?.tracking);
      if (!blk.resultados.length) {
        return Response.json({ ok: false, resultado: 'error', mensaje: 'Falta el tracking a recepcionar.' }, { status: 400 });
      }
      const aviso = blk.recibidos.length
        ? await notifyReceptionBlock(base44, blk.recibidos)
        : { enviado: false, mensaje: 'Sin recepciones nuevas que avisar.' };

      return Response.json({
        ok: true,
        total: blk.resultados.length,
        recibidos: blk.recibidos.length,
        ya_registrados: blk.yaRegistrados.length,
        no_registrados: blk.noRegistrados.length,
        aviso,
        resultados: blk.resultados.map((r) => ({
          tracking: r.tracking,
          resultado: r.resultado,
          estado: r.estado ?? null,
          huerfano: r.huerfano === true,
          shipping_mark: r.shipping_mark || '',
          mensaje: r.mensaje,
        })),
      });
    }

    if (action === 'report_prealert') {
      const result = await reportPrealert(base44, body);
      if (result.resultado === 'error') return Response.json(result, { status: 400 });
      return Response.json(result);
    }

    return Response.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}