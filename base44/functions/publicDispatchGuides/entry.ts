import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Consulta pública de guías de despacho: solo lectura y sin sesión de la app.
// Devuelve únicamente lo que necesita quien consulta desde el enlace: el número
// de guía, el número de contenedor de cada cliente, los bultos por cliente y los
// totales. No expone correos, cédulas ni direcciones. El filtrado, el conteo de
// coincidencias y la paginación se resuelven aquí.

const PAGE_SIZE = 40;
const MAX_PAGE_SIZE = 100;
const SIN_CONTENEDOR = /^sin\s+n/i;

const text = (value: any) => String(value ?? '').trim();
const num = (value: any) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// N° de contenedor de un cliente: los N° de orden/envío de sus bultos en la guía,
// sin repetir y sin las líneas que salieron sin contenedor asignado.
const containersOf = (client: any) => {
  const found = new Set<string>();
  (Array.isArray(client?.bultos) ? client.bultos : []).forEach((bulto: any) => {
    const number = text(bulto?.order_number);
    if (number && !SIN_CONTENEDOR.test(number)) found.add(number);
  });
  return [...found];
};

const clientOf = (client: any) => ({
  client_name: text(client?.client_name) || text(client?.client_email) || 'Cliente',
  shipping_mark: text(client?.shipping_mark) || text(client?.client?.shipping_mark),
  bultos: num(client?.totals?.bultos) || (Array.isArray(client?.bultos) ? client.bultos.length : 0),
  packages: num(client?.totals?.packages),
  unregistered: num(client?.totals?.unregistered),
  containers: containersOf(client),
});

const guideOf = (guide: any) => {
  const clients = (Array.isArray(guide?.clients) ? guide.clients : []).map(clientOf);
  return {
    id: guide.id,
    guide_number: text(guide.guide_number),
    emitted_date: guide.emitted_date || '',
    last_updated_date: guide.last_updated_date || '',
    auto_generated: !!guide.auto_generated,
    source: text(guide.source),
    dispatch_status: guide.dispatch_status === 'entregada' ? 'entregada' : 'emitida',
    delivered_date: guide.delivered_date || '',
    received_by: text(guide.received_by),
    totals: {
      clients: num(guide?.totals?.clients) || clients.length,
      bultos: num(guide?.totals?.bultos),
      packages: num(guide?.totals?.packages),
      unregistered: num(guide?.totals?.unregistered),
      cbm: num(guide?.totals?.cbm),
    },
    clients,
  };
};

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const query = text(body?.query ?? body?.search);
    const from = text(body?.from);
    const to = text(body?.to);
    const status = text(body?.status);
    const limit = Math.min(Math.max(num(body?.limit) || PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const skip = Math.max(num(body?.skip), 0);

    const andClauses: any[] = [];

    if (from || to) {
      const range: any = {};
      if (from) range.$gte = from;
      if (to) range.$lte = to;
      andClauses.push({ emitted_date: range });
    }

    if (status === 'emitida' || status === 'entregada') {
      andClauses.push({ dispatch_status: status });
    }

    // Búsqueda por cliente, shipping mark, número de guía o código de bulto.
    // El texto se escapa para que un carácter suelto no rompa la consulta.
    if (query) {
      const rx = { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
      andClauses.push({
        $or: [
          { guide_number: rx },
          { client_names: rx },
          { shipping_marks: rx },
          { bulto_codes: rx },
        ],
      });
    }

    const filter: any = andClauses.length ? { $and: andClauses } : {};

    const [rawGuides, matched] = await Promise.all([
      base44.asServiceRole.entities.DispatchGuide.filter(filter, '-emitted_date', limit, skip),
      base44.asServiceRole.entities.DispatchGuide.count(filter).catch(() => null),
    ]);

    const guides = (Array.isArray(rawGuides) ? rawGuides : []).map(guideOf);

    return Response.json({
      guides,
      matched: matched === null ? null : num(matched),
      has_more: guides.length === limit,
      next_skip: skip + guides.length,
      generated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'No se pudo consultar las guías' }, { status: 500 });
  }
}