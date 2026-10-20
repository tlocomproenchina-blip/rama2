// Exportación de los resultados del Portal de Consulta Compartido.
// El navegador arma el archivo con las filas que ya entregó el servidor: el
// portal nunca expone datos fuera del alcance ni de lo que se está viendo.
import { portalEstadoLabel, portalOrigenLabel } from '@/lib/sharedPortalFormat';

export const PORTAL_COLUMNS = [
  { key: 'tracking_number', label: 'Tracking', label_zh: '追踪号' },
  { key: 'shipping_mark', label: 'Shipping Mark', label_zh: '唛头' },
  { key: 'registro', label: 'Fecha de registro', label_zh: '登记日期' },
  { key: 'recepcion', label: 'Fecha de recepción', label_zh: '收货日期' },
  { key: 'estado', label: 'Estado', label_zh: '状态' },
  { key: 'origen', label: 'Origen', label_zh: '来源' },
  { key: 'photo_url', label: 'Foto de entrega', label_zh: '交货照片' },
];

// La tabla exportada arranca con dos filas de encabezado: el texto en español y,
// debajo, el mismo encabezado en chino mandarín.
const PORTAL_HEADER_ROWS = 2;

function cellText(row, key) {
  if (key === 'estado') return portalEstadoLabel(row?.estado);
  if (key === 'origen') return portalOrigenLabel(row?.origen);
  if (key === 'recepcion') return row?.recepcion || 'Pendiente';
  if (key === 'photo_url') return String(row?.photo_url || '');
  return String(row?.[key] ?? '');
}

export function portalRowsToAoa(rows) {
  return [
    PORTAL_COLUMNS.map((column) => column.label),
    PORTAL_COLUMNS.map((column) => column.label_zh),
    ...rows.map((row) => PORTAL_COLUMNS.map((column) => cellText(row, column.key))),
  ];
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function portalExportName(prefix = 'tlec-portal') {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${prefix}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

export function downloadPortalCsv(rows) {
  const aoa = portalRowsToAoa(rows);
  const body = aoa.map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  // Punto y coma + BOM: Excel en español abre el archivo en columnas.
  downloadBlob(`\uFEFF${body}`, `${portalExportName()}.csv`, 'text/csv;charset=utf-8');
}

export async function downloadPortalXlsx(rows) {
  const XLSX = await import('xlsx');
  const sheet = XLSX.utils.aoa_to_sheet(portalRowsToAoa(rows));
  // Foto de la entrega del cliente: viaja como enlace abrible desde el propio Excel.
  const photoColumn = PORTAL_COLUMNS.findIndex((column) => column.key === 'photo_url');
  rows.forEach((row, index) => {
    const target = String(row?.photo_url || '');
    if (!target) return;
    const ref = XLSX.utils.encode_cell({ r: index + PORTAL_HEADER_ROWS, c: photoColumn });
    if (sheet[ref]) sheet[ref].l = { Target: target, Tooltip: 'Foto de la entrega' };
  });
  sheet['!cols'] = [{ wch: 20 }, { wch: 18 }, { wch: 16 }, { wch: 26 }, { wch: 30 }, { wch: 16 }, { wch: 44 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Trackings');
  XLSX.writeFile(book, `${portalExportName()}.xlsx`);
}

export async function copyPortalRows(rows) {
  const text = portalRowsToAoa(rows).map((line) => line.join('\t')).join('\n');
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const area = document.createElement('textarea');
  area.value = text;
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  document.body.removeChild(area);
  return true;
}