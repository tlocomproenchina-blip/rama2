// Agrupa los contenedores por cliente en la pantalla "Contenedores por cliente".
// Los bultos son los que el backend cuenta desde las guías de despacho.

// Descripción visible del contenedor: "Paquete manual" se muestra como
// "Artículos varios", conservando el resto del texto.
export function normalizeContainerDescription(description) {
  return String(description || '').replace(/paquete\s+manual/gi, 'Artículos varios');
}

export function groupContainersByClient(rows = []) {
  const map = new Map();

  for (const row of rows) {
    const clientKey = String(row.client_email || row.shipping_mark || row.container || '').trim().toLowerCase();
    if (!clientKey) continue;

    if (!map.has(clientKey)) {
      map.set(clientKey, {
        key: clientKey,
        shipping_mark: String(row.shipping_mark || '').trim(),
        email: String(row.client_email || '').trim(),
        name: [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || String(row.client_email || 'Cliente sin nombre'),
        containers: [],
      });
    }

    const group = map.get(clientKey);
    if (!group.shipping_mark && row.shipping_mark) group.shipping_mark = String(row.shipping_mark).trim();
    group.containers.push({ ...row, description: normalizeContainerDescription(row.description) });
  }

  return [...map.values()]
    .map((group) => {
      const containers = [...group.containers].sort((a, b) => String(a.container).localeCompare(String(b.container), 'es', { numeric: true }));
      return {
        ...group,
        containers,
        totalContainers: containers.length,
        totalBultos: containers.reduce((sum, row) => sum + Number(row.bultos || 0), 0),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

// Clave única de un contenedor dentro de un cliente (para la selección fina).
export function containerKey(groupKey, container) {
  return `${groupKey}||${String(container ?? '').trim()}`;
}

// Devuelve solo los contenedores marcados, con los totales recalculados.
export function buildSelectionGroups(groups = [], keys = []) {
  if (!keys.length) return [];
  const set = new Set(keys);

  return groups
    .map((group) => {
      const containers = group.containers.filter((row) => set.has(containerKey(group.key, row.container)));
      if (!containers.length) return null;
      return {
        ...group,
        containers,
        totalContainers: containers.length,
        totalBultos: containers.reduce((sum, row) => sum + Number(row.bultos || 0), 0),
      };
    })
    .filter(Boolean);
}

// El reporte se genera en PDF desde src/lib/containersReportPdf.js