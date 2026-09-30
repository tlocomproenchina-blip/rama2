import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Guía de despacho consolidada por cliente: se arma SOLO con los bultos que
// pasaron por el escáner de despacho (DispatchScanLog con resultado
// 'dispatched' / 'already_dispatched'), nunca con las órdenes de despacho
// emitidas. Cada código aparece una sola vez por cliente, con la fecha del
// último escaneo, la cantidad de paquetes del bulto registrado y el número de
// orden de despacho cuando existe una orden del cliente que contenga ese código.
// El filtrado y los conteos se resuelven aquí; el frontend solo acumula páginas.

const MAX_LIMIT = 100;
const WIDE_LIMIT = 400;
const DISPATCH_RESULTS = ['dispatched', 'already_dispatched'];

const normCode = (raw: any) => String(raw || '').trim().toUpperCase();

// El código del bulto termina en -B## y su prefijo es el shipping mark del
// cliente (N6-TLEC-W1383S-B50338 → N6-TLEC-W1383S): permite deducir el cliente
// cuando la etiqueta escaneada ya no existe como bulto en el sistema.
const markOfCode = (code: any) => {
  const match = String(code || '').trim().match(/^(.*?)-B\d+$/i);
  return match ? match[1].trim().toUpperCase() : '';
};

// Conteo real del bulto: el conteo corregido por el almacén manda; si no está,
// se usa la cantidad de paquetes asociados y, por último, sus trackings (que
// incluyen los códigos sin registrar agregados al bulto).
const packageCountOfBulto = (bulto: any) => {
  if (!bulto) return 0;
  const cargo = Number(bulto.cargo_package_count);
  if (Number.isFinite(cargo) && cargo > 0) return cargo;
  const ids = Array.isArray(bulto.package_ids) ? bulto.package_ids.filter(Boolean) : [];
  if (ids.length) return ids.length;
  const trackings = Array.isArray(bulto.package_trackings) ? bulto.package_trackings.filter(Boolean) : [];
  return trackings.length;
};

const unique = (list: any[]) => [...new Set((list || []).filter(Boolean))];

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const from = String(body.from || '').trim();
    const to = String(body.to || '').trim();
    const search = String(body.search || '').trim();
    const clientEmail = String(body.client_email || '').trim();
    const clientEmails = Array.isArray(body.client_emails)
      ? unique(body.client_emails.map((e: any) => String(e || '').trim()))
      : [];
    const codes = Array.isArray(body.codes)
      ? unique(body.codes.map((c: any) => normCode(c))).slice(0, 1000)
      : [];
    const wide = clientEmails.length > 0;
    const requestedLimit = Math.max(Number(body.limit) || 60, 1);
    const limit = Math.min(requestedLimit, wide || codes.length ? WIDE_LIMIT : MAX_LIMIT);
    const skip = Math.max(Number(body.skip) || 0, 0);

    const andClauses: any[] = [];

    // 1) Rango de fechas: el día en que el bulto se escaneó (scanned_at), con
    // respaldo en la fecha de registro para los escaneos anteriores a ese campo.
    if (from || to) {
      const range: any = {};
      if (from) range.$gte = from;
      if (to) range.$lte = to;
      andClauses.push({ $or: [{ scanned_at: range }, { created_date: range }] });
    }

    // 2) Clientes concretos (emisión de la guía): todos sus escaneos del rango,
    // incluso los que quedaron registrados sin email pero con el código del bulto.
    if (wide || clientEmail) {
      const emails = wide ? clientEmails : [clientEmail];
      const orClause: any[] = [{ client_email: { $in: emails } }];
      if (wide) {
        const clientBultos = await base44.asServiceRole.entities.Bulto
          .filter({ client_email: { $in: emails } }, '-created_date', 2000)
          .catch(() => []);
        const clientCodes = unique((clientBultos || []).map((b: any) => normCode(b?.label_code)));
        if (clientCodes.length) orClause.push({ bulto_label_code: { $in: clientCodes } });
      }
      andClauses.push({ $or: orClause });
    }

    // 3) Códigos escaneados concretos (clientes cuyo email no se pudo identificar).
    if (codes.length) andClauses.push({ bulto_label_code: { $in: codes } });

    // 4) Búsqueda libre: cliente, nombre, shipping mark, código de bulto y
    // tracking. Los bultos que coinciden por código o por tracking se resuelven
    // aparte para incluir también los escaneos que no guardaron el email.
    if (search && !wide) {
      const rx = { $regex: search, $options: 'i' };
      const or: any[] = [
        { scanned_code: rx },
        { bulto_label_code: rx },
        { client_name: rx },
        { client_email: rx },
        { shipping_mark: rx },
        { tracking_number: rx },
      ];
      try {
        const matchedBultos = await base44.asServiceRole.entities.Bulto.filter(
          { $or: [{ label_code: rx }, { package_trackings: rx }] }, '-created_date', 100
        );
        const found = unique((matchedBultos || []).map((b: any) => normCode(b?.label_code)));
        if (found.length) or.push({ bulto_label_code: { $in: found } });
      } catch (_) {}
      andClauses.push({ $or: or });
    }

    // Solo los bultos que todavía no forman parte de una guía emitida: al generar
    // la guía sus escaneos quedan marcados y salen de la lista de pendientes.
    const filter: any = { scan_type: 'bulto', result: { $in: DISPATCH_RESULTS }, guide_id: { $exists: false } };
    if (andClauses.length) filter.$and = andClauses;

    const effectiveSkip = wide || codes.length ? 0 : skip;
    const rawLogs = await base44.asServiceRole.entities.DispatchScanLog
      .filter(filter, '-created_date', limit, effectiveSkip);
    const logs: any[] = Array.isArray(rawLogs) ? rawLogs : [];

    // --- Agrupar los escaneos por código de bulto (el último escaneo manda) ---
    const codeMap = new Map();
    logs.forEach((log) => {
      const code = normCode(log?.bulto_label_code || log?.scanned_code);
      if (!code) return;
      const date = log?.scanned_at || log?.created_date || '';
      const existing: any = codeMap.get(code);
      if (!existing) {
        codeMap.set(code, {
          label_code: code,
          date,
          scans: 1,
          scan_package_count: Number(log?.package_count) || 0,
          client_email: String(log?.client_email || '').trim(),
          client_name: String(log?.client_name || '').trim(),
          shipping_mark: String(log?.shipping_mark || '').trim(),
        });
        return;
      }
      existing.scans += 1;
      if (date && (!existing.date || date > existing.date)) existing.date = date;
      if (!existing.client_email && log?.client_email) existing.client_email = String(log.client_email).trim();
      if (!existing.client_name && log?.client_name) existing.client_name = String(log.client_name).trim();
      if (!existing.shipping_mark && log?.shipping_mark) existing.shipping_mark = String(log.shipping_mark).trim();
      existing.scan_package_count = Math.max(existing.scan_package_count, Number(log?.package_count) || 0);
    });

    const rows: any[] = [...codeMap.values()];
    const emailSet = new Set<string>(rows.map((r) => String(r.client_email || '').trim()).filter(Boolean));

    // --- Códigos sin cliente en el escaneo: se deduce el cliente por el mark ---
    const markCodes = new Map<string, string[]>();
    rows.forEach((row) => {
      if (row.client_email) return;
      const mark = markOfCode(row.label_code);
      if (!mark) return;
      if (!markCodes.has(mark)) markCodes.set(mark, []);
      (markCodes.get(mark) as string[]).push(row.label_code);
    });

    const profileByMark: any = {};
    if (markCodes.size) {
      const marks = [...markCodes.keys()];
      const usersByMark = await base44.asServiceRole.entities.User
        .filter({ shipping_mark: { $in: marks } }, undefined, marks.length + 10)
        .catch(() => []);
      (usersByMark || []).forEach((u: any) => {
        const mark = normCode(u?.shipping_mark);
        if (mark && !profileByMark[mark]) profileByMark[mark] = u;
      });
      markCodes.forEach((codesList, mark) => {
        const owner = profileByMark[mark];
        if (!owner?.email) return;
        codesList.forEach((code) => {
          const row: any = codeMap.get(code);
          if (!row) return;
          row.client_email = owner.email;
          row.client_name = row.client_name || owner.full_name || '';
          row.shipping_mark = row.shipping_mark || owner.shipping_mark || mark;
          emailSet.add(String(owner.email).trim());
        });
      });

      // Marcas sin usuario registrado: se hereda el cliente de un bulto del mark.
      const missingMarks = marks.filter((m) => !profileByMark[m]);
      if (missingMarks.length) {
        const bultosByMark = await base44.asServiceRole.entities.Bulto
          .filter({ shipping_mark: { $in: missingMarks } }, '-created_date', 500)
          .catch(() => []);
        const ownerByMark: any = {};
        (bultosByMark || []).forEach((b: any) => {
          const mark = normCode(b?.shipping_mark);
          if (mark && b?.client_email && !ownerByMark[mark]) ownerByMark[mark] = b;
        });
        markCodes.forEach((codesList, mark) => {
          const owner = ownerByMark[mark];
          if (!owner) return;
          codesList.forEach((code) => {
            const row: any = codeMap.get(code);
            if (!row) return;
            row.client_email = owner.client_email;
            row.client_name = row.client_name || owner.client_snapshot?.full_name || '';
            row.shipping_mark = row.shipping_mark || owner.shipping_mark || mark;
            emailSet.add(String(owner.client_email).trim());
          });
        });
      }
    }

    // --- Bultos registrados y perfiles de los clientes implicados ---
    const emails = [...emailSet];
    let rawBultos: any[] = [];
    let rawProfiles: any[] = [];
    if (emails.length) {
      const [bultos, profiles] = await Promise.all([
        base44.asServiceRole.entities.Bulto.filter({ client_email: { $in: emails } }, '-created_date', 2000).catch(() => []),
        base44.asServiceRole.entities.User.filter({ email: { $in: emails } }, undefined, emails.length + 10).catch(() => []),
      ]);
      rawBultos = bultos || [];
      rawProfiles = profiles || [];
    }

    const bultoByCode: any = {};
    (rawBultos || []).forEach((b: any) => {
      const code = normCode(b?.label_code);
      if (code && !bultoByCode[code]) bultoByCode[code] = b;
    });

    const profileByEmail: any = {};
    [...Object.values(profileByMark), ...(rawProfiles || [])].forEach((p: any) => {
      const email = String(p?.email || '').trim().toLowerCase();
      if (email && !profileByEmail[email]) profileByEmail[email] = p;
    });

    // --- Número de orden de despacho: solo cuando una orden del cliente
    // contiene ese código de bulto ---
    const orderByCode: any = {};
    const ordersByClient: any = {};
    if (emails.length) {
      const orders = await base44.asServiceRole.entities.DispatchOrder
        .filter({ client_email: { $in: emails }, status: { $ne: 'cancelada' } }, '-created_date', 400)
        .catch(() => []);
      (orders || []).forEach((o: any) => {
        const items = Array.isArray(o?.items) ? o.items : [];
        const orderCodes = unique([normCode(o?.bulto_label_code), ...items.map((i: any) => normCode(i?.bulto_label_code))]);
        if (!orderCodes.length) return;
        const key = String(o?.client_email || '').trim().toLowerCase();
        if (!ordersByClient[key]) ordersByClient[key] = new Set<string>();
        ordersByClient[key].add(o.id);
        orderCodes.forEach((code) => {
          if (!orderByCode[code]) orderByCode[code] = { number: o?.order_number || '', client: key };
        });
      });
    }

    // --- Agrupar los bultos escaneados por cliente ---
    const groups = new Map<string, any>();
    rows.forEach((row) => {
      const email = String(row.client_email || '').trim();
      const mark = row.shipping_mark || markOfCode(row.label_code);
      const key = email ? email.toLowerCase() : `unknown:${mark || 'sin-mark'}`;
      if (!groups.has(key)) groups.set(key, { key, email, rows: [] });
      groups.get(key).rows.push({ ...row, mark });
    });

    const clients: any[] = [];
    groups.forEach((group: any) => {
      const emailKey = String(group.email || '').trim().toLowerCase();
      const groupBultos = group.rows.map((r: any) => bultoByCode[r.label_code]).filter(Boolean);
      const snapshot =
        groupBultos.map((b: any) => b.client_snapshot).find((s: any) => s && (s.address || s.cedula || s.whatsapp)) ||
        groupBultos[0]?.client_snapshot ||
        {};
      const profile = profileByEmail[emailKey] || profileByMark[normCode(group.rows[0]?.mark)] || null;
      const mark = group.rows.map((r: any) => r.mark).find(Boolean) || profile?.shipping_mark || '';

      const bultos = group.rows
        .map((r: any) => {
          const bulto = bultoByCode[r.label_code] || null;
          const counted = bulto ? packageCountOfBulto(bulto) : 0;
          const order = orderByCode[r.label_code];
          return {
            label_code: r.label_code,
            package_count: counted > 0 ? counted : Number(r.scan_package_count) || 0,
            registered: !!bulto,
            date: r.date || '',
            order_number: order && order.client === emailKey ? order.number : '',
            scans: r.scans || 1,
          };
        })
        .sort((a: any, b: any) => String(a.label_code).localeCompare(String(b.label_code)));

      const clientData = {
        full_name: snapshot.full_name || profile?.full_name || group.rows.find((r: any) => r.client_name)?.client_name || '',
        cedula: snapshot.cedula || profile?.cedula || '',
        whatsapp: snapshot.whatsapp || profile?.whatsapp || '',
        address: snapshot.address || profile?.address || '',
        city: snapshot.city || profile?.city || '',
        state: snapshot.state || profile?.state || '',
        email: group.email || snapshot.email || '',
        shipping_mark: mark,
      };

      clients.push({
        client_key: group.key,
        client_email: group.email,
        client_name: clientData.full_name || group.email || `Cliente — ${mark || 'sin mark'}`,
        shipping_mark: mark,
        client: clientData,
        bultos,
        orders_count: ordersByClient[emailKey]?.size || 0,
        totals: {
          bultos: bultos.length,
          packages: bultos.reduce((sum: number, b: any) => sum + (Number(b.package_count) || 0), 0),
          scanned: group.rows.reduce((sum: number, r: any) => sum + (Number(r.scans) || 1), 0),
        },
      });
    });

    clients.sort(
      (a, b) => b.totals.bultos - a.totals.bultos || String(a.client_name).localeCompare(String(b.client_name))
    );

    const totals = clients.reduce(
      (acc, c) => ({
        clients: acc.clients + 1,
        bultos: acc.bultos + c.totals.bultos,
        packages: acc.packages + c.totals.packages,
        scanned: acc.scanned + c.totals.scanned,
      }),
      { clients: 0, bultos: 0, packages: 0, scanned: 0 }
    );

    return Response.json({
      clients,
      totals,
      has_more: !wide && !codes.length && logs.length === limit,
      next_skip: effectiveSkip + logs.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}