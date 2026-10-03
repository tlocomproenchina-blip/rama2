import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { connectionLabel, logWholesalerEvent, resolveConnectionForKey, stampOf, truncate } from '../../shared/wholesalerCore.ts';

// Lado mayorista de la integración: recibe el aviso de que la carga llegó al
// almacén de China. Lo deja en el historial de movimientos (marcado con el
// mayorista que lo envía) y marca los paquetes registrados como recibidos.
const MAX_PACKAGES = 200;

function normalizePackages(body: any) {
  const list = Array.isArray(body?.paquetes)
    ? body.paquetes
    : (Array.isArray(body?.packages) ? body.packages : []);
  if (list.length) return list;

  const tracking = body?.tracking || body?.tracking_number;
  if (tracking) {
    return [{
      tracking,
      shipping_mark: body?.shipping_mark || '',
      client_email: body?.client_email || '',
      package_count: body?.package_count,
      fecha: body?.received_date || body?.fecha,
    }];
  }
  return [];
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const connection = await resolveConnectionForKey(base44, req.headers.get('x-api-key') || '');
    if (!connection) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stamp = stampOf(connection);
    const body = await req.json().catch(() => ({}));
    const packages = normalizePackages(body).slice(0, MAX_PACKAGES);
    if (!packages.length) {
      return Response.json({ ok: false, mensaje: 'El aviso llegó sin trackings.' }, { status: 400 });
    }

    const resumen = { recibidos: 0, ya_registrados: 0, no_registrados: 0 };
    const avisoFecha = body?.fecha || body?.received_date || new Date().toISOString();

    for (const pkg of packages) {
      const tracking = String(pkg?.tracking || pkg?.tracking_number || '').trim();
      if (!tracking) continue;

      const fecha = pkg?.fecha || pkg?.received_date || avisoFecha;
      let encontrado: any = null;
      try {
        const rows = await base44.asServiceRole.entities.Package.filter({ tracking_number: tracking }, '-created_date', 1);
        encontrado = rows?.[0] || null;
      } catch (_) {
        encontrado = null;
      }

      if (!encontrado) {
        resumen.no_registrados += 1;
        await logWholesalerEvent(base44, {
          event_type: 'no_registrado',
          tracking_number: tracking,
          shipping_mark: pkg?.shipping_mark || '',
          result: 'no_registrado',
          detail: 'Aviso del mayorista: el tracking no está registrado en TLEC CARGO',
          ...stamp,
        });
        continue;
      }

      if (encontrado.received_date || encontrado.status === 'recibido') {
        resumen.ya_registrados += 1;
        await logWholesalerEvent(base44, {
          event_type: 'recepcion_existente',
          tracking_number: tracking,
          client_email: encontrado.client_email || '',
          shipping_mark: encontrado.shipping_mark || pkg?.shipping_mark || '',
          package_id: encontrado.id,
          result: 'ya_registrado',
          detail: 'Aviso del mayorista: la carga ya estaba recibida en China',
          ...stamp,
        });
        continue;
      }

      try {
        await base44.asServiceRole.entities.Package.update(encontrado.id, {
          status: 'recibido',
          received_date: fecha,
          received_by: 'app del mayorista',
        });
        resumen.recibidos += 1;
        await logWholesalerEvent(base44, {
          event_type: 'recepcion',
          tracking_number: tracking,
          client_email: encontrado.client_email || '',
          shipping_mark: encontrado.shipping_mark || pkg?.shipping_mark || '',
          package_id: encontrado.id,
          result: 'recibido',
          detail: truncate('Aviso del mayorista: carga recibida en China', 900),
          ...stamp,
        });
      } catch (err: any) {
        resumen.no_registrados += 1;
        await logWholesalerEvent(base44, {
          event_type: 'no_registrado',
          tracking_number: tracking,
          result: 'error',
          detail: truncate(err?.message || 'No se pudo marcar el paquete como recibido', 900),
          ...stamp,
        });
      }
    }

    return Response.json({
      ok: true,
      evento: body?.evento || 'carga_recibida_en_china',
      mayorista: connectionLabel(connection),
      total: packages.length,
      ...resumen,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}