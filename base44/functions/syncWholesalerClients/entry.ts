import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  connectionKeyOf,
  connectionLabel,
  getPrimaryConnection,
  listWholesalerConnections,
  logWholesalerEvent,
  truncate,
  updateConnection,
} from '../../shared/wholesalerCore.ts';
import { fetchWholesalerClients, intakeClients } from '../../shared/wholesalerIntake.ts';
import { retryPendingReceptions } from '../../shared/wholesalerNotify.ts';
import { sendWholesalerReport } from '../../shared/wholesalerReport.ts';
import { registerConnectionResult } from '../../shared/wholesalerHealth.ts';

// Corte diario con las apps de los clientes mayoristas: recorre todas las
// conexiones, pide los clientes nuevos de cada una, los da de alta aquí,
// reintenta los avisos de recepción pendientes y envía el informe de las últimas
// 24 horas de cada mayorista. Lo dispara el horario programado (8:00 a.m.
// Caracas) o un administrador desde el panel.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const isAutomation = req.headers.get('x-base44-automation') === 'true';
    if (!isAutomation && (!user || user.role !== 'admin')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const onlyKey = String(body?.connection_key || '').trim();

    let connections = await listWholesalerConnections(base44);
    if (!connections.length) connections = [await getPrimaryConnection(base44)];
    if (onlyKey) {
      connections = connections.filter((c: any) => connectionKeyOf(c) === onlyKey || c.id === onlyKey);
    }

    const results: any[] = [];
    for (const connection of connections) {
      results.push(await runConnection(base44, connection));
    }

    const nuevos = results.reduce((sum, r) => sum + (Number(r.nuevos) || 0), 0);
    const avisosPendientes = results.reduce((sum, r) => sum + (Number(r.avisosPendientes) || 0), 0);

    return Response.json({
      ok: true,
      conexiones: results.length,
      nuevos,
      avisos_pendientes: avisosPendientes,
      resultados: results,
      mensaje: results.length === 1
        ? `${results[0].name}: ${results[0].mensaje}`
        : `${results.length} mayorista(s) consultado(s) · ${nuevos} cliente(s) nuevo(s) en total.`,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function runConnection(base44: any, connection: any) {
  const now = new Date().toISOString();
  const name = connectionLabel(connection);
  const key = connectionKeyOf(connection);
  const item: any = {
    name,
    key,
    consultados: 0,
    nuevos: 0,
    existentes: 0,
    errores: 0,
    avisosPendientes: 0,
    mensaje: '',
    informe: null,
    avisos: null,
  };

  if (connection?.intake_enabled === false) {
    item.mensaje = 'La consulta de clientes nuevos está desactivada.';
    await updateConnection(base44, connection?.id, {
      last_run_date: now,
      last_run_status: 'ok',
      last_run_message: item.mensaje,
    });
  } else {
    const feed = await fetchWholesalerClients(base44, connection);
    if (!feed.ok) {
      item.mensaje = feed.error;
      await updateConnection(base44, connection?.id, {
        last_run_date: now,
        last_run_status: 'error',
        last_run_message: truncate(feed.error, 900),
      });
      await logWholesalerEvent(base44, {
        event_type: 'sync_fallido',
        wholesaler_key: key,
        wholesaler_name: name,
        result: 'error',
        detail: truncate(feed.error, 900),
      });
      await registerConnectionResult(base44, connection, {
        ok: false,
        error: feed.error,
        missing: !String(connection?.clients_feed_url || '').trim(),
      });
    } else {
      const records = await intakeClients(base44, feed.clients, connection);
      item.consultados = feed.clients.length;
      item.nuevos = records.filter((r: any) => r?.status === 'pendiente').length;
      item.existentes = records.filter((r: any) => r?.status === 'existente').length;
      item.errores = records.filter((r: any) => r?.status === 'error').length;
      item.mensaje = `${item.nuevos} cliente(s) nuevo(s) por crear su cuenta, ${item.existentes} ya existían, ${item.errores} con error.`;

      await updateConnection(base44, connection?.id, {
        last_cursor: now,
        last_run_date: now,
        last_run_status: 'ok',
        last_run_clients_count: records.length,
        last_run_message: item.mensaje,
      });
      await registerConnectionResult(base44, connection, {
        ok: true,
        clients: item.consultados,
        message: `Conectado: respondió con ${item.consultados} cliente(s) en el corte.`,
      });
    }
  }

  // Avisos de recepción que quedaron pendientes para este mayorista
  item.avisos = await retryPendingReceptions(base44, connection);
  item.avisosPendientes = Number(item.avisos?.pendientes) || 0;

  // Informe diario de este mayorista
  item.informe = await sendWholesalerReport(base44, connection);

  return item;
}