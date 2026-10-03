import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { getWholesalerConfig, updateWholesalerConfig, logWholesalerEvent, truncate } from '../../shared/wholesalerCore.ts';
import { fetchWholesalerClients, intakeClients } from '../../shared/wholesalerIntake.ts';
import { retryPendingReceptions } from '../../shared/wholesalerNotify.ts';
import { sendWholesalerReport } from '../../shared/wholesalerReport.ts';

// Corte diario con la app del cliente mayorista: pide sus clientes nuevos, los da
// de alta aquí, reintenta los avisos de recepción pendientes y envía el informe
// de las últimas 24 horas. Lo dispara el horario programado (8:00 a.m. Caracas)
// o un administrador desde el panel.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const isAutomation = req.headers.get('x-base44-automation') === 'true';
    if (!isAutomation && (!user || user.role !== 'admin')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const cfg = await getWholesalerConfig(base44);
    const summary: any = { consultados: 0, nuevos: 0, existentes: 0, errores: 0, informe: null, avisos: null, mensaje: '' };
    const now = new Date().toISOString();

    if (cfg?.intake_enabled === false) {
      summary.mensaje = 'La consulta de clientes nuevos está desactivada.';
      await updateWholesalerConfig(base44, { last_run_date: now, last_run_status: 'ok', last_run_message: summary.mensaje });
    } else {
      const feed = await fetchWholesalerClients(base44, cfg);
      if (!feed.ok) {
        summary.mensaje = feed.error;
        await updateWholesalerConfig(base44, {
          last_run_date: now,
          last_run_status: 'error',
          last_run_message: truncate(feed.error, 900),
        });
        await logWholesalerEvent(base44, { event_type: 'sync_fallido', result: 'error', detail: truncate(feed.error, 900) });
      } else {
        const records = await intakeClients(base44, feed.clients);
        summary.consultados = feed.clients.length;
        summary.nuevos = records.filter((r: any) => r?.status === 'pendiente').length;
        summary.existentes = records.filter((r: any) => r?.status === 'existente').length;
        summary.errores = records.filter((r: any) => r?.status === 'error').length;

        const message = `${summary.nuevos} cliente(s) nuevo(s) por crear su cuenta, ${summary.existentes} ya existían, ${summary.errores} con error.`;
        await updateWholesalerConfig(base44, {
          last_cursor: now,
          last_run_date: now,
          last_run_status: 'ok',
          last_run_clients_count: records.length,
          last_run_message: message,
        });
        summary.mensaje = message;
      }
    }

    // Avisos de recepción que quedaron pendientes
    summary.avisos = await retryPendingReceptions(base44);

    // Informe diario
    if (cfg?.report_email_enabled === false) {
      summary.informe = { enviado: false, mensaje: 'El informe por correo está desactivado: el detalle queda en el panel.' };
    } else {
      summary.informe = await sendWholesalerReport(base44, cfg);
    }

    return Response.json({ ok: true, ...summary });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}