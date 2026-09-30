import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Datos de la guía de despacho consolidada: órdenes de despacho del rango
// filtrado, agrupadas por cliente, con el código de etiqueta de cada bulto y su
// cantidad de paquetes resueltos contra el registro del bulto (Bulto).
// El filtrado y los conteos se resuelven aquí; el frontend solo acumula páginas.

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 60;

const normTracking = (raw) => String(raw || '').split(/[:：]/).pop().trim().toUpperCase();

// Conteo real del bulto: el conteo corregido por el almacén manda; si no está,
// se usa la cantidad de paquetes asociados y, por último, sus trackings.
const packageCountOfBulto = (bulto) => {
  if (!bulto) return 0;
  const cargo = Number(bulto.cargo_package_count);
  if (Number.isFinite(cargo) && cargo > 0) return cargo;
  const ids = Array.isArray(bulto.package_ids) ? bulto.package_ids.filter(Boolean) : [];
  if (ids.length) return ids.length;
  const trackings = Array.isArray(bulto.package_trackings) ? bulto.package_trackings.filter(Boolean) : [];
  return trackings.length;
};

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const from = String(body.from || '').trim();
    const to = String(body.to || '').trim();
    const clientEmail = String(body.client_email || '').trim();
    const clientEmails = Array.isArray(body.client_emails)
      ? [...new Set(body.client_emails.map((e) => String(e || '').trim()).filter(Boolean))]
      : [];
    const search = String(body.search || '').trim();
    const requestedLimit = Math.max(Number(body.limit) || DEFAULT_LIMIT, 1);
    // Al pedir clientes concretos (emisión de la guía) se permite un tope mayor
    // para traer todas sus órdenes del rango y no dejar ningún bulto fuera.
    const maxLimit = clientEmails.length ? 400 : MAX_LIMIT;
    const limit = Math.min(requestedLimit, maxLimit);
    const skip = Math.max(Number(body.skip) || 0, 0);

    const filter: any = { status: { $ne: 'cancelada' } };
    if (from || to) {
      const range: any = {};
      if (from) range.$gte = from;
      if (to) range.$lte = to;
      filter.created_date = range;
    }
    if (clientEmails.length) filter.client_email = { $in: clientEmails };
    else if (clientEmail) filter.client_email = clientEmail;

    // Búsqueda libre: número de orden, cliente, shipping mark, código de bulto y
    // tracking. Los bultos que coinciden por código o por tracking se resuelven
    // aparte para incluir también las órdenes que no llevan el código arriba.
    if (search && !clientEmails.length) {
      const rx = { $regex: search, $options: 'i' };
      const or: any[] = [
        { order_number: rx },
        { client_name: rx },
        { client_email: rx },
        { shipping_mark: rx },
        { bulto_label_code: rx },
        { 'items.tracking_number': rx },
      ];
      try {
        const matchedBultos = await base44.asServiceRole.entities.Bulto.filter(
          { $or: [{ label_code: rx }, { package_trackings: rx }] }, '-created_date', 100
        );
        const codes = (matchedBultos || []).map((b: any) => b.label_code).filter(Boolean);
        if (codes.length) or.push({ bulto_label_code: { $in: codes } });
      } catch (_) {}
      filter.$or = or;
    }

    const effectiveSkip = clientEmails.length ? 0 : skip;
    const rawOrders = await base44.asServiceRole.entities.DispatchOrder.filter(filter, '-created_date', limit, effectiveSkip);
    const orders: any[] = Array.isArray(rawOrders) ? rawOrders : [];
    const emails = [...new Set(orders.map((o) => String(o.client_email || '').trim()).filter(Boolean))];

    const [rawBultos, rawProfiles] = await Promise.all([
      emails.length
        ? base44.asServiceRole.entities.Bulto.filter({ client_email: { $in: emails } }, '-created_date', 2000).catch(() => [])
        : Promise.resolve([]),
      emails.length
        ? base44.asServiceRole.entities.User.filter({ email: { $in: emails } }, undefined, emails.length + 10).catch(() => [])
        : Promise.resolve([]),
    ]);

    // Índices de bultos para resolver el código de etiqueta y el conteo real.
    const bultoByCode: any = {};
    const bultoByTracking: any = {};
    (rawBultos || []).forEach((b: any) => {
      if (b?.label_code) bultoByCode[String(b.label_code).trim().toUpperCase()] = b;
      (Array.isArray(b?.package_trackings) ? b.package_trackings : []).forEach((t: any) => {
        const key = normTracking(t);
        if (key && !bultoByTracking[key]) bultoByTracking[key] = b;
      });
    });

    const profileByEmail: any = {};
    (rawProfiles || []).forEach((p: any) => {
      if (p?.email) profileByEmail[String(p.email).trim().toLowerCase()] = p;
    });

    // Agrupar las órdenes de la página por cliente.
    const groups = new Map();
    for (const order of orders) {
      const email = String(order.client_email || '').trim();
      const key = email.toLowerCase() || `orden_${order.id}`;
      if (!groups.has(key)) groups.set(key, { email, orders: [] });
      (groups.get(key) as any).orders.push(order);
    }

    const clients: any[] = [];

    for (const group of groups.values()) {
      const g = group as any;
      const profile = profileByEmail[g.email.toLowerCase()] || null;
      const snapshot =
        g.orders.map((o: any) => o.client_snapshot || {}).find((s: any) => s && (s.address || s.cedula || s.whatsapp)) ||
        g.orders[0]?.client_snapshot ||
        {};

      const codeMap = new Map();

      for (const order of g.orders) {
        const date = order.dispatched_date || order.created_date || '';
        const orderItems = Array.isArray(order.items) ? order.items : [];
        const resolved = new Map();

        const addCode = (code, bulto) => {
          const clean = String(code || '').trim();
          if (!clean || resolved.has(clean)) return;
          resolved.set(clean, {
            label_code: clean,
            package_count: bulto ? packageCountOfBulto(bulto) : 0,
            confirmed: !!bulto,
          });
        };

        // 1) Código guardado al despachar (nuevo) — en el ítem o en la orden
        orderItems.forEach((item: any) => {
          const code = String(item?.bulto_label_code || '').trim();
          if (code) addCode(code, bultoByCode[code.toUpperCase()]);
        });
        if (order.bulto_label_code) {
          addCode(order.bulto_label_code, bultoByCode[String(order.bulto_label_code).trim().toUpperCase()]);
        }

        // 2) Órdenes antiguas: resolver el bulto cruzando los trackings de la
        // orden con los package_trackings de los bultos del mismo cliente.
        if (resolved.size === 0) {
          orderItems.forEach((item: any) => {
            const bulto = bultoByTracking[normTracking(item?.tracking_number)];
            if (bulto?.label_code) addCode(bulto.label_code, bulto);
          });
        }

        // 3) Sin bulto identificable: se imprime una fila "sin código" para no
        // inventar un código ni perder los paquetes del despacho.
        if (resolved.size === 0 && orderItems.length > 0) {
          resolved.set(`sin_codigo_${order.id}`, {
            label_code: '',
            package_count: orderItems.length,
            confirmed: false,
          });
        }

        resolved.forEach((row: any, codeKey: string) => {
          const existing: any = codeMap.get(codeKey);
          if (existing) {
            existing.package_count = Math.max(Number(existing.package_count) || 0, Number(row.package_count) || 0);
            existing.confirmed = existing.confirmed || row.confirmed;
            return;
          }
          codeMap.set(codeKey, { ...row, date, order_number: order.order_number || '' });
        });
      }

      const bultos: any[] = [...codeMap.values()];
      const client = {
        full_name: snapshot.full_name || profile?.full_name || '',
        cedula: snapshot.cedula || profile?.cedula || '',
        whatsapp: snapshot.whatsapp || profile?.whatsapp || '',
        address: snapshot.address || profile?.address || '',
        city: snapshot.city || profile?.city || '',
        state: snapshot.state || profile?.state || '',
        email: g.email || snapshot.email || profile?.email || '',
        shipping_mark: snapshot.shipping_mark || profile?.shipping_mark || g.orders[0]?.shipping_mark || '',
      };

      clients.push({
        client_email: g.email,
        client_name: client.full_name || g.orders[0]?.client_name || g.email,
        shipping_mark: g.orders[0]?.shipping_mark || client.shipping_mark || '',
        client,
        bultos,
        orders_count: g.orders.length,
        totals: {
          bultos: bultos.filter((b) => b.label_code).length,
          packages: bultos.reduce((sum, b) => sum + (Number(b.package_count) || 0), 0),
          unconfirmed: bultos.filter((b) => !b.confirmed).length,
        },
      });
    }

    clients.sort(
      (a, b) => b.totals.bultos - a.totals.bultos || String(a.client_name).localeCompare(String(b.client_name))
    );

    const totals = clients.reduce(
      (acc, c) => ({
        clients: acc.clients + 1,
        bultos: acc.bultos + c.totals.bultos,
        packages: acc.packages + c.totals.packages,
        unconfirmed: acc.unconfirmed + c.totals.unconfirmed,
      }),
      { clients: 0, bultos: 0, packages: 0, unconfirmed: 0 }
    );

    return Response.json({
      clients,
      totals,
      has_more: !clientEmails.length && orders.length === limit,
      next_skip: effectiveSkip + orders.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}