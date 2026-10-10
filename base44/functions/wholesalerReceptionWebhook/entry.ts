import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { connectionLabel, logWholesalerEvent, resolveConnectionForKey, stampOf, truncate } from '../../shared/wholesalerCore.ts';
import { receiveTracking } from '../../shared/wholesalerPackages.ts';

// Lado mayorista de la integración: recibe el aviso de que la carga llegó al
// almacén de China. Cada tracking del aviso queda registrado en TLEC CARGO: si
// todavía no existía se guarda como una pre-alerta normal (a nombre de su cliente,
// si se reconoce) y se marca recibido, así ninguna carga reportada por el
// mayorista se queda por fuera de la base de datos.
const MAX_PACKAGES = 200;

// El aviso puede llegar con los trackings bajo distintos nombres (paquetes,
// packages, prealertas, trackings) y también como una lista de textos sueltos:
// se admiten todas las formas para no perder ninguna carga reportada.
function normalizePackages(body: any) {
  const candidates = [body?.paquetes, body?.packages, body?.prealertas, body?.prealerts, body?.trackings];
  const list = candidates.find((value) => Array.isArray(value) && value.length) || [];
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
      // Un aviso que no se puede leer queda registrado: así se ve en el panel que
      // el mayorista sí llamó y con qué campos, en vez de perderse en silencio.
      await logWholesalerEvent(base44, {
        event_type: 'aviso_fallido',
        tracking_number: String(body?.tracking || body?.tracking_number || '').trim(),
        result: 'sin_trackings',
        detail: truncate(`El aviso llegó sin trackings. Campos recibidos: ${Object.keys(body || {}).join(', ') || 'ninguno'}`, 300),
        ...stamp,
      });
      return Response.json({ ok: false, mensaje: 'El aviso llegó sin trackings.' }, { status: 400 });
    }

    const avisoFecha = body?.fecha || body?.received_date || new Date().toISOString();
    const resultados: any[] = [];

    for (const pkg of packages) {
      const raw = typeof pkg === 'string' ? pkg : (pkg?.tracking || pkg?.tracking_number);
      const tracking = String(raw || '').trim();
      if (!tracking) continue;

      try {
        const r = await receiveTracking(base44, tracking, connection, {
          fecha: pkg?.fecha || pkg?.received_date || avisoFecha,
          client_email: pkg?.client_email || body?.client_email || '',
          shipping_mark: pkg?.shipping_mark || body?.shipping_mark || '',
          package_count: pkg?.package_count,
          create_if_missing: true,
        });
        resultados.push({
          tracking,
          resultado: r.resultado,
          estado: r.estado ?? null,
          creado: r.creado === true,
          huerfano: r.huerfano === true,
          foto_pendiente: r.foto_pendiente === true,
          mensaje: r.mensaje,
        });
      } catch (err: any) {
        const error = truncate(err?.message || 'No se pudo procesar el tracking.', 300);
        await logWholesalerEvent(base44, {
          event_type: 'no_registrado',
          tracking_number: tracking,
          result: 'error',
          detail: error,
          ...stamp,
        });
        resultados.push({ tracking, resultado: 'error', creado: false, foto_pendiente: false, mensaje: error });
      }
    }

    const cuantos = (resultado: string) => resultados.filter((r) => r.resultado === resultado).length;

    return Response.json({
      ok: true,
      evento: body?.evento || 'carga_recibida_en_china',
      mayorista: connectionLabel(connection),
      total: resultados.length,
      recibidos: cuantos('recibido'),
      ya_registrados: cuantos('ya_registrado'),
      no_registrados: cuantos('no_registrado'),
      // Cargas que el mayorista reportó y que no estaban registradas: quedaron
      // guardadas en TLEC CARGO (como pre-alerta de su cliente o como huérfano).
      creados: resultados.filter((r) => r.creado).length,
      sin_foto: resultados.filter((r) => r.foto_pendiente).length,
      resultados,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}