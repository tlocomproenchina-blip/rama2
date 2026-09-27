import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { runChannelAction } from '../../shared/serviceChannel.ts';

// Canal de servicio total de TLEC (puerta única para las apps de las empresas socias).
// Capacidades: entidades (lectura y escritura), funciones de backend, archivos,
// directorio de clientes, configuración y lotes. Todo entra con la llave de la
// empresa; el canal estampa el contexto de empresa, aplica las reglas de acceso y
// registra el consumo por socia.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-api-key, x-company-key',
};

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(String(value)) : fallback;
  } catch (_) {
    return fallback;
  }
}

export default async function (req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    const key = req.headers.get('x-api-key')
      || req.headers.get('x-company-key')
      || url.searchParams.get('key')
      || '';

    let action = 'health';
    let params: any = {};
    let actor: any = null;
    let file: any = null;

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      action = String(form.get('action') || 'files');
      params = parseJson(form.get('params'), {});
      actor = parseJson(form.get('actor'), null);
      file = form.get('file');
    } else {
      const body = await req.json().catch(() => ({}));
      action = body?.action || 'health';
      params = body?.params || {};
      actor = body?.actor || null;
    }

    const result = await runChannelAction(base44, { key, action, params, actor, file });
    return Response.json(result.body, { status: result.status, headers: CORS_HEADERS });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: CORS_HEADERS });
  }
}