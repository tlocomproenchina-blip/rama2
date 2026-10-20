// Agrupa los contenedores por cliente y arma el Excel de la pantalla
// "Contenedores por cliente": una hoja de resumen por cliente y otra con el
// detalle de cada contenedor. Los bultos son los que el backend cuenta desde
// las guías de despacho.

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

export async function downloadContainersByClientReport(groups = []) {
  const XLSX = await import('xlsx');

  const summary = [
    ['Shipping mark', 'Cliente', 'Email', 'Contenedores', 'Bultos en guías de despacho', 'N° de contenedores'],
    ...groups.map((group) => [
      group.shipping_mark || '',
      group.name || '',
      group.email || '',
      group.totalContainers,
      group.totalBultos,
      group.containers.map((row) => row.container).join(', '),
    ]),
  ];

  const detail = [
    ['Shipping mark', 'Cliente', 'N° de contenedor (factura)', 'Cantidad de bultos', 'Descripción'],
    ...groups.flatMap((group) =>
      group.containers.map((row) => [
        group.shipping_mark || '',
        group.name || '',
        row.container || '',
        Number(row.bultos || 0),
        row.description || '',
      ])
    ),
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  summarySheet['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 30 }, { wch: 14 }, { wch: 30 }, { wch: 40 }];

  const detailSheet = XLSX.utils.aoa_to_sheet(detail);
  detailSheet['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 26 }, { wch: 18 }, { wch: 60 }];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, summarySheet, 'Resumen por cliente');
  XLSX.utils.book_append_sheet(book, detailSheet, 'Detalle por contenedor');
  XLSX.writeFile(book, `contenedores-por-cliente-${new Date().toISOString().slice(0, 10)}.xlsx`);
}