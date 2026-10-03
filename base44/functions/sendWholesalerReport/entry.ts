import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { connectionLabel, findConnectionById, getPrimaryConnection, listWholesalerConnections } from '../../shared/wholesalerCore.ts';
import { sendWholesalerReport } from '../../shared/wholesalerReport.ts';

// Reenvía el informe de clientes nuevos desde el panel (por ejemplo cuando el
// correo diario no pudo salir). Sin conexión indicada, recorre todas y cada
// mayorista recibe su propio informe.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const id = String(body?.connection_id || '').trim();

    let connections: any[] = [];
    if (id) {
      const found = await findConnectionById(base44, id);
      if (found) connections = [found];
    } else {
      connections = await listWholesalerConnections(base44);
    }
    if (!connections.length) connections = [await getPrimaryConnection(base44)];

    const results: any[] = [];
    for (const connection of connections) {
      const result = await sendWholesalerReport(base44, connection);
      results.push({ name: connectionLabel(connection), ...result });
    }

    const enviado = results.some((r) => r.enviado);
    const total = results.reduce((sum, r) => sum + (Number(r.total) || 0), 0);

    return Response.json({
      ok: true,
      enviado,
      conexiones: results.length,
      total,
      results: results,
      mensaje: enviado
        ? `Informe enviado: ${total} cliente(s) nuevo(s).`
        : results.map((r) => `${r.name}: ${r.mensaje}`).join(' · '),
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}