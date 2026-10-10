import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { connectionKeyOf, getPrimaryConnection, listWholesalerConnections } from '../../shared/wholesalerCore.ts';
import { syncWholesalerHistoryConnection } from '../../shared/wholesalerHistory.ts';

// Trae el historial completo de pre-alertas de cada mayorista y lo alinea con TLEC
// CARGO. Lo dispara un administrador desde el panel de mayoristas o el horario
// programado (3:00 a.m. Caracas). Se puede pedir solo una conexión con
// connection_key. Repetirlo no duplica nada: lo que ya está se omite.
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
      results.push(await syncWholesalerHistoryConnection(base44, connection));
    }

    const sum = (field: string) => results.reduce((total, row) => total + (Number(row[field]) || 0), 0);
    const nuevos = sum('nuevos');
    const actualizados = sum('actualizados');
    const omitidos = sum('omitidos');
    const fallidos = sum('fallidos');
    const avisosEnviados = sum('avisos_enviados');
    const avisosFallidos = sum('avisos_fallidos');

    return Response.json({
      ok: true,
      conexiones: results.length,
      total: sum('total'),
      nuevos,
      actualizados,
      omitidos,
      fallidos,
      // Coincidencias ya recibidas que se le devolvieron a cada mayorista.
      avisos_enviados: avisosEnviados,
      avisos_fallidos: avisosFallidos,
      resultados: results,
      mensaje: results.length === 1
        ? `${results[0].name}: ${results[0].mensaje}`
        : `${results.length} mayorista(s): ${nuevos} nueva(s), ${actualizados} actualizada(s), ${omitidos} ya alineada(s)${fallidos ? `, ${fallidos} con error` : ''}. ${avisosEnviados} coincidencia(s) ya recibida(s) devuelta(s) al mayorista${avisosFallidos ? ` (${avisosFallidos} con error)` : ''}.`,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}