import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { codeTailRegex } from '../../shared/bultoCodeQuery.ts';

// Historial de guías de despacho emitidas. El filtrado (rango de fechas, estado
// de entrega y búsqueda por número, cliente, mark o código de bulto), la
// paginación y el contador de guías pendientes de entrega se resuelven aquí; el
// frontend solo acumula páginas.
// Con { count_only: true } devuelve únicamente el contador de pendientes de entrega.

const MAX_LIMIT = 100;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));

    const pendingCount = async () => {
      const count = await base44.asServiceRole.entities.DispatchGuide
        .count({ dispatch_status: 'emitida' })
        .catch(() => 0);
      return Number(count) || 0;
    };

    if (body.count_only) {
      return Response.json({ pending_delivery_count: await pendingCount() });
    }

    const from = String(body.from || '').trim();
    const to = String(body.to || '').trim();
    const search = String(body.search || '').trim();
    const status = String(body.status || '').trim();
    const limit = Math.min(Math.max(Number(body.limit) || 40, 1), MAX_LIMIT);
    const skip = Math.max(Number(body.skip) || 0, 0);

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

    if (search) {
      const rx = { $regex: search, $options: 'i' };
      const or: any[] = [
        { guide_number: rx },
        { client_names: rx },
        { shipping_marks: rx },
        { bulto_codes: rx },
      ];
      // Los últimos caracteres de un código de bulto (con o sin guiones, con o sin
      // la "B") encuentran la guía que lo incluyó.
      const tail = codeTailRegex(search);
      if (tail) or.push({ bulto_codes: { $regex: tail, $options: 'i' } });
      andClauses.push({ $or: or });
    }

    const filter: any = andClauses.length ? { $and: andClauses } : {};

    const rawGuides = await base44.asServiceRole.entities.DispatchGuide
      .filter(filter, '-emitted_date', limit, skip);
    const guides: any[] = Array.isArray(rawGuides) ? rawGuides : [];

    return Response.json({
      guides,
      has_more: guides.length === limit,
      next_skip: skip + guides.length,
      pending_delivery_count: await pendingCount(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}