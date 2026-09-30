// Utilidades de la guía de despacho consolidada por cliente.
// Se usan en /WarehouseDispatch y, cuando no hay conexión, para armar la guía
// con los despachos que ya están guardados en la caché local del almacén.

export const normTracking = (raw) => String(raw || '').split(/[:：]/).pop().trim().toUpperCase();

// Conteo real del bulto: el conteo corregido por el almacén manda; si no está,
// se usa la cantidad de paquetes asociados y, por último, sus trackings.
export const packageCountOfBulto = (bulto) => {
  if (!bulto) return 0;
  const cargo = Number(bulto.cargo_package_count);
  if (Number.isFinite(cargo) && cargo > 0) return cargo;
  const ids = Array.isArray(bulto.package_ids) ? bulto.package_ids.filter(Boolean) : [];
  if (ids.length) return ids.length;
  const trackings = Array.isArray(bulto.package_trackings) ? bulto.package_trackings.filter(Boolean) : [];
  return trackings.length;
};

// Índices de bultos: por código de etiqueta y por tracking contenido.
export function indexBultos(bultos) {
  const byCode = {};
  const byTracking = {};
  (Array.isArray(bultos) ? bultos : []).forEach((b) => {
    if (!b) return;
    if (b.label_code) byCode[String(b.label_code).trim().toUpperCase()] = b;
    (Array.isArray(b.package_trackings) ? b.package_trackings : []).forEach((t) => {
      const key = normTracking(t);
      if (key && !byTracking[key]) byTracking[key] = b;
    });
  });
  return { byCode, byTracking };
}

// Resuelve los bultos de una orden de despacho: primero el código guardado al
// despachar, después el cruce de trackings con los bultos del mismo cliente y,
// si nada coincide, una fila "sin código" con los paquetes de la orden.
export function resolveOrderBultos(order, indexes) {
  const { byCode = {}, byTracking = {} } = indexes || {};
  const items = Array.isArray(order?.items) ? order.items : [];
  const found = new Map();

  const addCode = (code, bulto) => {
    const clean = String(code || '').trim();
    if (!clean || found.has(clean)) return;
    found.set(clean, {
      label_code: clean,
      package_count: bulto ? packageCountOfBulto(bulto) : 0,
      confirmed: !!bulto,
    });
  };

  items.forEach((item) => {
    const code = String(item?.bulto_label_code || '').trim();
    if (code) addCode(code, byCode[code.toUpperCase()]);
  });
  if (order?.bulto_label_code) {
    addCode(order.bulto_label_code, byCode[String(order.bulto_label_code).trim().toUpperCase()]);
  }

  if (found.size === 0) {
    items.forEach((item) => {
      const bulto = byTracking[normTracking(item?.tracking_number)];
      if (bulto?.label_code) addCode(bulto.label_code, bulto);
    });
  }

  if (found.size === 0 && items.length > 0) {
    found.set(`sin_codigo_${order?.id || 'orden'}`, {
      label_code: '',
      package_count: items.length,
      confirmed: false,
    });
  }

  const date = order?.dispatched_date || order?.created_date || '';
  return [...found.values()].map((row) => ({ ...row, date, order_number: order?.order_number || '' }));
}

// Agrupa órdenes de despacho por cliente (mismo formato que devuelve el backend).
export function groupOrdersIntoGuideClients({ orders, bultos, clients }) {
  const indexes = indexBultos(bultos);
  const clientByEmail = {};
  (Array.isArray(clients) ? clients : []).forEach((c) => {
    const email = String(c?.email || '').trim().toLowerCase();
    if (email) clientByEmail[email] = c;
  });

  const groups = new Map();
  (Array.isArray(orders) ? orders : []).forEach((order) => {
    const email = String(order?.client_email || '').trim();
    const key = email.toLowerCase() || `orden_${order?.id}`;
    if (!groups.has(key)) groups.set(key, { email, orders: [] });
    groups.get(key).orders.push(order);
  });

  const result = [];
  groups.forEach((group) => {
    const profile = clientByEmail[group.email.toLowerCase()] || {};
    const snapshot = group.orders.find((o) => o.client_snapshot && (o.client_snapshot.address || o.client_snapshot.cedula))?.client_snapshot
      || group.orders[0]?.client_snapshot
      || {};

    const codeMap = new Map();
    group.orders.forEach((order) => {
      resolveOrderBultos(order, indexes).forEach((row) => {
        const key = row.label_code || `sin_codigo_${order.id}`;
        const existing = codeMap.get(key);
        if (existing) {
          existing.package_count = Math.max(existing.package_count || 0, row.package_count || 0);
          existing.confirmed = existing.confirmed || row.confirmed;
          return;
        }
        codeMap.set(key, row);
      });
    });

    const guideBultos = [...codeMap.values()];
    const clientData = {
      full_name: snapshot.full_name || profile.full_name || '',
      cedula: snapshot.cedula || profile.cedula || '',
      whatsapp: snapshot.whatsapp || profile.whatsapp || '',
      address: snapshot.address || profile.address || '',
      city: snapshot.city || profile.city || '',
      state: snapshot.state || profile.state || '',
      email: group.email || snapshot.email || profile.email || '',
      shipping_mark: snapshot.shipping_mark || profile.shipping_mark || group.orders[0]?.shipping_mark || '',
    };

    result.push({
      client_email: group.email,
      client_name: clientData.full_name || group.orders[0]?.client_name || group.email,
      shipping_mark: group.orders[0]?.shipping_mark || clientData.shipping_mark || '',
      client: clientData,
      bultos: guideBultos,
      orders_count: group.orders.length,
      totals: {
        bultos: guideBultos.filter((b) => b.label_code).length,
        packages: guideBultos.reduce((sum, b) => sum + (Number(b.package_count) || 0), 0),
        unconfirmed: guideBultos.filter((b) => !b.confirmed).length,
      },
    });
  });

  return sortGuideClients(result);
}

export function sortGuideClients(clients) {
  return [...(Array.isArray(clients) ? clients : [])].sort(
    (a, b) => (b.totals?.bultos || 0) - (a.totals?.bultos || 0) || String(a.client_name).localeCompare(String(b.client_name))
  );
}

// Acumula las páginas siguientes ("cargar más") sin duplicar bultos.
export function mergeGuideClients(current, incoming) {
  const map = new Map();
  [...(Array.isArray(current) ? current : []), ...(Array.isArray(incoming) ? incoming : [])].forEach((client) => {
    const key = client.client_email || client.client_name;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...client, bultos: [...(client.bultos || [])] });
      return;
    }
    const seen = new Set(existing.bultos.map((b) => b.label_code || `sin_${b.order_number}`));
    (client.bultos || []).forEach((b) => {
      const code = b.label_code || `sin_${b.order_number}`;
      if (seen.has(code)) return;
      seen.add(code);
      existing.bultos.push(b);
    });
    const bultos = existing.bultos;
    existing.totals = {
      bultos: bultos.filter((b) => b.label_code).length,
      packages: bultos.reduce((sum, b) => sum + (Number(b.package_count) || 0), 0),
      unconfirmed: bultos.filter((b) => !b.confirmed).length,
    };
  });
  return sortGuideClients([...map.values()]);
}

// Resumen de la guía: clientes, bultos y paquetes de los clientes marcados.
export function summarizeGuide(clients, selectedEmails) {
  const selected = (Array.isArray(clients) ? clients : []).filter((c) => (selectedEmails || []).includes(c.client_email));
  return selected.reduce(
    (acc, c) => ({
      clients: acc.clients + 1,
      bultos: acc.bultos + (c.totals?.bultos || 0),
      packages: acc.packages + (c.totals?.packages || 0),
      unconfirmed: acc.unconfirmed + (c.totals?.unconfirmed || 0),
    }),
    { clients: 0, bultos: 0, packages: 0, unconfirmed: 0 }
  );
}

// Filtro local (solo para la ruta sin conexión) sobre las órdenes del dispositivo.
export function filterOrdersLocally(orders, { from, to, search } = {}) {
  const term = String(search || '').trim().toLowerCase();
  const fromMs = from ? new Date(`${from}T00:00:00`).getTime() : null;
  const toMs = to ? new Date(`${to}T23:59:59.999`).getTime() : null;

  return (Array.isArray(orders) ? orders : []).filter((order) => {
    if (order?.status === 'cancelada') return false;
    const raw = order?.dispatched_date || order?.created_date;
    const ms = raw ? new Date(raw).getTime() : null;
    if (fromMs && (ms === null || ms < fromMs)) return false;
    if (toMs && (ms === null || ms > toMs)) return false;
    if (!term) return true;
    const haystack = [
      order?.order_number,
      order?.client_name,
      order?.client_email,
      order?.shipping_mark,
      order?.bulto_label_code,
      ...(order?.items || []).flatMap((i) => [i?.tracking_number, i?.bulto_label_code]),
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(term);
  });
}