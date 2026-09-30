// Utilidades de la guía de despacho consolidada por cliente.
// La guía se arma SOLO con los bultos que pasaron por el escáner de despacho
// (historial de escaneos), nunca con las órdenes de despacho emitidas. Este
// módulo replica en el dispositivo el mismo agrupado que hace el backend, para
// que la guía se pueda ver y emitir cuando el almacén trabaja sin conexión.

export const DISPATCH_SCAN_RESULTS = ['dispatched', 'already_dispatched'];

export const normCode = (raw) => String(raw || '').trim().toUpperCase();

export const normTracking = (raw) => String(raw || '').split(/[:：]/).pop().trim().toUpperCase();

// El código del bulto termina en -B## y su prefijo es el shipping mark del
// cliente (N6-TLEC-W1383S-B50338 → N6-TLEC-W1383S): permite deducir el cliente
// cuando la etiqueta escaneada ya no existe como bulto en el sistema.
export const markOfCode = (code) => {
  const match = String(code || '').trim().match(/^(.*?)-B\d+$/i);
  return match ? match[1].trim().toUpperCase() : '';
};

// Conteo real del bulto: el conteo corregido por el almacén manda; si no está,
// se usa la cantidad de paquetes asociados y, por último, sus trackings (que
// incluyen los códigos sin registrar agregados al bulto).
export const packageCountOfBulto = (bulto) => {
  if (!bulto) return 0;
  const cargo = Number(bulto.cargo_package_count);
  if (Number.isFinite(cargo) && cargo > 0) return cargo;
  const ids = Array.isArray(bulto.package_ids) ? bulto.package_ids.filter(Boolean) : [];
  if (ids.length) return ids.length;
  const trackings = Array.isArray(bulto.package_trackings) ? bulto.package_trackings.filter(Boolean) : [];
  return trackings.length;
};

const scanDate = (log) => log?.scanned_at || log?.created_date || '';

const unique = (list) => [...new Set((list || []).filter(Boolean))];

// Filtro local (solo para la ruta sin conexión) sobre los escaneos del dispositivo.
export function filterGuideScanLogsLocally(logs, { from, to, search } = {}) {
  const term = String(search || '').trim().toLowerCase();
  const fromMs = from ? new Date(`${from}T00:00:00`).getTime() : null;
  const toMs = to ? new Date(`${to}T23:59:59.999`).getTime() : null;

  return (Array.isArray(logs) ? logs : []).filter((log) => {
    if (log?.scan_type !== 'bulto') return false;
    if (!DISPATCH_SCAN_RESULTS.includes(log?.result)) return false;
    const raw = scanDate(log);
    const ms = raw ? new Date(raw).getTime() : null;
    if (fromMs && (ms === null || ms < fromMs)) return false;
    if (toMs && (ms === null || ms > toMs)) return false;
    if (!term) return true;
    const haystack = [
      log?.scanned_code,
      log?.bulto_label_code,
      log?.client_email,
      log?.client_name,
      log?.shipping_mark,
      log?.tracking_number,
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(term);
  });
}

// Agrupa los escaneos de bulto por cliente (mismo formato que devuelve el backend).
export function buildGuideFromScanLogs({ logs, bultos, clients, orders } = {}) {
  const bultoByCode = {};
  (Array.isArray(bultos) ? bultos : []).forEach((b) => {
    const code = normCode(b?.label_code);
    if (code && !bultoByCode[code]) bultoByCode[code] = b;
  });

  const clientByEmail = {};
  const clientByMark = {};
  (Array.isArray(clients) ? clients : []).forEach((c) => {
    const email = String(c?.email || '').trim().toLowerCase();
    if (email) clientByEmail[email] = c;
    const mark = normCode(c?.shipping_mark);
    if (mark && !clientByMark[mark]) clientByMark[mark] = c;
  });

  const orderByCode = {};
  (Array.isArray(orders) ? orders : []).forEach((o) => {
    if (o?.status === 'cancelada') return;
    const items = Array.isArray(o?.items) ? o.items : [];
    unique([normCode(o?.bulto_label_code), ...items.map((i) => normCode(i?.bulto_label_code))]).forEach((code) => {
      if (!orderByCode[code]) orderByCode[code] = o?.order_number || '';
    });
  });

  // Dedupe por código: se conserva el último escaneo y se cuentan los repetidos.
  const codeMap = new Map();
  (Array.isArray(logs) ? logs : []).forEach((log) => {
    const code = normCode(log?.bulto_label_code || log?.scanned_code);
    if (!code) return;
    const date = scanDate(log);
    const existing = codeMap.get(code);
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

  const groups = new Map();
  codeMap.forEach((row) => {
    const bulto = bultoByCode[row.label_code] || null;
    const mark = row.shipping_mark || normCode(bulto?.shipping_mark) || markOfCode(row.label_code);
    let email = String(row.client_email || bulto?.client_email || '').trim();
    if (!email && mark) email = String(clientByMark[mark]?.email || '').trim();
    const key = email ? email.toLowerCase() : `unknown:${mark || 'sin-mark'}`;
    if (!groups.has(key)) groups.set(key, { key, email, rows: [] });
    groups.get(key).rows.push({ ...row, mark, bulto });
  });

  const result = [];
  groups.forEach((group) => {
    const profile = group.email ? clientByEmail[group.email.toLowerCase()] : null;
    const groupBultos = group.rows.map((r) => r.bulto).filter(Boolean);
    const snapshot = groupBultos.map((b) => b.client_snapshot).find((s) => s && (s.address || s.cedula || s.whatsapp))
      || groupBultos[0]?.client_snapshot
      || {};
    const mark = group.rows.map((r) => r.mark).find(Boolean) || profile?.shipping_mark || '';

    const bultosRows = group.rows.map((r) => {
      const counted = r.bulto ? packageCountOfBulto(r.bulto) : 0;
      return {
        label_code: r.label_code,
        package_count: counted > 0 ? counted : Number(r.scan_package_count) || 0,
        registered: !!r.bulto,
        date: r.date,
        order_number: orderByCode[r.label_code] || '',
        scans: r.scans || 1,
      };
    }).sort((a, b) => String(a.label_code).localeCompare(String(b.label_code)));

    const clientData = {
      full_name: snapshot.full_name || profile?.full_name || group.rows.find((r) => r.client_name)?.client_name || '',
      cedula: snapshot.cedula || profile?.cedula || '',
      whatsapp: snapshot.whatsapp || profile?.whatsapp || '',
      address: snapshot.address || profile?.address || '',
      city: snapshot.city || profile?.city || '',
      state: snapshot.state || profile?.state || '',
      email: group.email || snapshot.email || '',
      shipping_mark: mark,
    };

    result.push({
      client_key: group.key,
      client_email: group.email,
      client_name: clientData.full_name || group.email || `Sin registrar — ${mark || 'sin mark'}`,
      shipping_mark: mark,
      client: clientData,
      bultos: bultosRows,
      totals: {
        bultos: bultosRows.length,
        packages: bultosRows.reduce((sum, b) => sum + (Number(b.package_count) || 0), 0),
        unregistered: bultosRows.filter((b) => !b.registered).length,
        scanned: group.rows.reduce((sum, r) => sum + (Number(r.scans) || 1), 0),
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
    const key = client.client_key || client.client_email || client.client_name;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...client, bultos: [...(client.bultos || [])] });
      return;
    }
    const seen = new Set(existing.bultos.map((b) => b.label_code));
    (client.bultos || []).forEach((b) => {
      if (seen.has(b.label_code)) return;
      seen.add(b.label_code);
      existing.bultos.push(b);
    });
    const bultos = existing.bultos;
    existing.totals = {
      bultos: bultos.length,
      packages: bultos.reduce((sum, b) => sum + (Number(b.package_count) || 0), 0),
      unregistered: bultos.filter((b) => !b.registered).length,
      scanned: existing.totals?.scanned || bultos.length,
    };
  });
  return sortGuideClients([...map.values()]);
}

// Resumen de la guía: clientes, bultos y paquetes de los clientes marcados.
export function summarizeGuide(clients, selectedKeys) {
  const selected = (Array.isArray(clients) ? clients : []).filter((c) => (selectedKeys || []).includes(c.client_key));
  return selected.reduce(
    (acc, c) => ({
      clients: acc.clients + 1,
      bultos: acc.bultos + (c.totals?.bultos || 0),
      packages: acc.packages + (c.totals?.packages || 0),
      unregistered: acc.unregistered + (c.totals?.unregistered || 0),
    }),
    { clients: 0, bultos: 0, packages: 0, unregistered: 0 }
  );
}