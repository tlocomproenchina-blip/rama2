// Exporta las incidencias de almacén a Excel: número de contenedor, cliente con
// su código y la foto. La foto vive en almacenamiento privado, así que cada fila
// lleva un enlace firmado (7 días) para abrirla desde el archivo.
import { base44 } from '@/api/base44Client';

const HEADERS = [
  'N° de contenedor',
  'Código de cliente',
  'Cliente',
  'Email',
  'Notas',
  'Registrado por',
  'Fecha',
  'Foto',
];

const PHOTO_COLUMN = HEADERS.length - 1;

async function signPhoto(uri) {
  if (!uri) return '';
  try {
    const res = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: uri, expires_in: 604800 });
    return res?.signed_url || res?.data?.signed_url || '';
  } catch (_) {
    const res = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: uri, expires_in: 3600 }).catch(() => null);
    return res?.signed_url || res?.data?.signed_url || '';
  }
}

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('es-VE');
};

export async function downloadWarehouseIncidents(incidents = []) {
  const XLSX = await import('xlsx');
  const links = await Promise.all(incidents.map((item) => signPhoto(item.photo_uri)));

  const rows = incidents.map((item, index) => [
    item.container_number || '',
    item.client_code || '',
    item.client_name || '',
    item.client_email || '',
    item.notes || '',
    item.reported_by_name || item.reported_by || '',
    formatDate(item.reported_date || item.created_date),
    links[index] ? 'Abrir foto' : 'Sin foto',
  ]);

  const sheet = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);

  links.forEach((link, index) => {
    if (!link) return;
    const cell = sheet[XLSX.utils.encode_cell({ r: index + 1, c: PHOTO_COLUMN })];
    if (cell) cell.l = { Target: link, Tooltip: 'Abrir la foto de la incidencia' };
  });

  sheet['!cols'] = [{ wch: 20 }, { wch: 18 }, { wch: 28 }, { wch: 30 }, { wch: 50 }, { wch: 26 }, { wch: 20 }, { wch: 14 }];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Incidencias');
  XLSX.writeFile(book, `incidencias-almacen-${new Date().toISOString().slice(0, 10)}.xlsx`);
}