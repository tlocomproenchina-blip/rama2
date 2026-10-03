import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { connectionLabel, findConnectionById, getPrimaryConnection } from '../../shared/wholesalerCore.ts';
import { probeConnection, registerConnectionResult } from '../../shared/wholesalerHealth.ts';

// Prueba de conexión de un mayorista: consulta su app en el momento (un solo
// cliente, sin traer ni crear nada), guarda el resultado en su conexión y
// devuelve el estado al panel.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const id = String(body?.connection_id || '').trim();
    const connection = id ? await findConnectionById(base44, id) : await getPrimaryConnection(base44);
    if (!connection?.id) {
      return Response.json({ error: 'No se encontró esa conexión.' }, { status: 404 });
    }

    const probe = await probeConnection(connection);
    const result = await registerConnectionResult(base44, connection, probe);
    const clients = Number(probe.clients) || 0;

    return Response.json({
      ok: probe.ok === true,
      status: result.status,
      alerted: result.alerted === true,
      name: connectionLabel(connection),
      clients,
      mensaje: probe.ok
        ? `Conectado: la app del mayorista respondió con ${clients} cliente(s).`
        : probe.error,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}