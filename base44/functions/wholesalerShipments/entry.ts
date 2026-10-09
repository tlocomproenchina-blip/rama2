import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { findConnectionById, listWholesalerConnections } from '../../shared/wholesalerCore.ts';
import { avisoReady, clientSummaryOfConnection, countShipments, shipmentStatusFor, shipmentsOfConnection } from '../../shared/wholesalerOutbound.ts';

// Panel de envíos al mayorista (solo administradores): qué se le ha enviado a su
// app (el tracking y las fotos de cada carga recibida), qué quedó pendiente o
// fallido, y el estado de una carga concreta consultada por su tracking.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const connections = await listWholesalerConnections(base44);
    const connection = body?.connection_id ? await findConnectionById(base44, body.connection_id) : null;
    const aviso_configurado = connection ? avisoReady(connection) : null;

    if (body?.action === 'status') {
      const result = await shipmentStatusFor(base44, connection, body?.search);
      if (result.ok === false) return Response.json({ ...result, aviso_configurado }, { status: 400 });
      return Response.json({ ...result, aviso_configurado });
    }

    const from = String(body?.from || '').trim() || null;
    const limit = Math.min(200, Math.max(1, Number(body?.limit) || 50));

    const [shipments, counts, clients] = await Promise.all([
      shipmentsOfConnection(base44, connections, connection, from, limit),
      countShipments(base44, connections, connection, from),
      clientSummaryOfConnection(base44, connections, connection, from),
    ]);

    return Response.json({ ok: true, shipments, counts, clients, aviso_configurado });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}