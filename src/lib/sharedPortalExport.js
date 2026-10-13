// Exportación de los resultados del Portal de Consulta Compartido.
// El navegador arma el archivo con las filas que ya entregó el servidor: el
// portal nunca expone datos fuera del alcance ni de lo que se está viendo.
import { portalEstadoLabel, portalOrigenLabel } from '@/lib/sharedPortalFormat';

export const PORTAL_COLUMNS = [
  { key: 'tracking_number', label: 'Tracking' },
  { key: 'shipping_mark', label: 'Shipping Mark' },
  { key: 'wholesaler', label: 'Mayorista' },
  { key: 'client', label: 'Cliente' },
  { key: 'client_email', label: 'Correo del cliente' },
  { key: 'registro', label: 'Fecha de registro' },
  { key: 'recepcion', label: 'Fecha de recepción' },
  { key: 'estado', label: 'Estado' },
  { key: 'origen', label: 'Origen' },
];

function cellText(row, key) {
  if (key === 'estado') return portalEstadoLabel(row?.estado);
  if (key === 'origen') return portalOrigenLabel(row?.origen);
  if (key === 'recepcion') return row?.recepcion || 'Pendiente';
  return String(row?.[key] ?? '');
}

export function portalRowsToAoa(rows) {
  return [PORTAL_COLUMNS.map((column) => column.label), ...rows.map((row) => PORTAL_COLUMNS.map((column) => cellText(row, column.key)))];
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
  sheet['!cols'] = [{ wch: 20 }, { wch: 18 }, { wch: 16 }, { wch: 26 }, { wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 18 }];
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