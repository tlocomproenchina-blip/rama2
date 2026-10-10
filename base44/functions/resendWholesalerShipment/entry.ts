import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { findConnectionById, getPrimaryConnection, truncate } from '../../shared/wholesalerCore.ts';
import { notifyReceptionBlock } from '../../shared/wholesalerNotify.ts';
import { findPackageByTracking, packagePhotos } from '../../shared/wholesalerPackages.ts';

// Reintento manual del aviso de una carga al mayorista (solo administradores): se
// vuelve a enviar el tracking con las fotos del paquete, y el intento con su
// resultado queda anotado en el historial de ese envío.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const logId = String(body?.log_id || '').trim();
    if (!logId) {
      return Response.json({ ok: false, enviado: false, mensaje: 'Falta el aviso a reenviar.' }, { status: 400 });
    }

    const log = await base44.asServiceRole.entities.WholesalerLog.get(logId).catch(() => null);
    if (!log) {
      return Response.json({ ok: false, enviado: false, mensaje: 'Ese aviso no existe.' }, { status: 404 });
    }

    // La dirección y la clave salen de la conexión de ese mayorista, nunca de quien llama.
    const connection = (await findConnectionById(base44, log.wholesaler_key)) || (await getPrimaryConnection(base44));
    const pkg = log.package_id
      ? await base44.asServiceRole.entities.Package.get(log.package_id).catch(() => null)
      : await findPackageByTracking(base44, log.tracking_number);

    const result = await notifyReceptionBlock(base44, [{
      tracking: log.tracking_number || '',
      shipping_mark: log.shipping_mark || pkg?.shipping_mark || '',
      client_email: log.client_email || pkg?.client_email || '',
      estado: 'recibido',
      fecha: log.event_date || new Date().toISOString(),
      log_id: log.id,
      fotos: packagePhotos(pkg),
    }], connection);

    return Response.json({
      ok: true,
      enviado: result.enviado === true,
      mensaje: truncate(result.mensaje, 500),
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}