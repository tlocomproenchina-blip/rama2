import { base44 } from '@/components/api/ApiQueueManager';
import { toast } from 'sonner';

/**
 * Exporta todos los paquetes en pre-alerta a un archivo TXT agrupado por shipping mark.
 * Usa exportPaginated para descargar el dataset completo desde el backend.
 */
export async function exportPreAlerta({ onProgress, filters = {} } = {}) {
  try {
    const { exportPaginated } = await import('@/lib/exportPaginated');
    const { q, statusFilter, reportedFilter, advancedFilters } = filters;
    const preAlertaPkgs = await exportPaginated(
      'listPackagesForSupport',
      { q, statusFilter, reportedFilter, advancedFilters },
      { onProgress, label: 'Descargando paquetes' }
    );

    if (preAlertaPkgs.length === 0) {
      toast.error('No hay paquetes para exportar con los filtros actuales');
      onProgress?.(null);
      return;
    }

    onProgress?.({ total: preAlertaPkgs.length, remaining: 0, label: 'Generando archivo...' });

    // Cargar usuarios vía backend (asServiceRole) para resolver shipping marks
    const userRes = await base44.functions.invoke('listAllUsers', { role: 'user', limit: 5000 });
    const userMap = {};
    (userRes?.data?.users || []).forEach(u => { userMap[u.email] = u; });

    // Agrupar por cliente
    const clientMap = {};
    preAlertaPkgs.forEach(pkg => {
      if (!clientMap[pkg.client_email]) clientMap[pkg.client_email] = [];
      clientMap[pkg.client_email].push(pkg);
    });

    let content = '';
    const clients = Object.keys(clientMap).sort();
    clients.forEach((email, index) => {
      const pkgs = clientMap[email];
      const shippingMark = userMap[email]?.shipping_mark || 'N/A';
      content += `Cliente \n${shippingMark}\ntracking Number\n`;
      pkgs.forEach(pkg => {
        const desc = pkg.description ? ` - ${pkg.description}` : '';
        content += `${pkg.tracking_number}${desc}\n`;
      });
      if (index < clients.length - 1) content += '\n\n';
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pre_alerta_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();

    toast.success(`Exportado ${preAlertaPkgs.length} paquetes (filtros aplicados)`);
  } catch (error) {
    toast.error('Error al exportar');
    console.error(error);
  }
  onProgress?.(null);
}

/**
 * Exporta los paquetes seleccionados a un Excel (CSV con BOM UTF-8 para Excel)
 * Columnas: Cliente (Shipping Mark), Numero de tracking, Descripcion, Foto (URL)
 * El archivo se nombra con la fecha y hora actual.
 */
export async function exportSelectedToExcel(selectedPackages = []) {
  try {
    if (!selectedPackages || selectedPackages.length === 0) {
      toast.error('No hay paquetes seleccionados');
      return;
    }

    const XLSX = await import('xlsx');

    const fmtDate = (d) => {
      if (!d) return '';
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return '';
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`;
    };

    const headers = ['Cliente', 'Numero de tracking', 'Descripcion', 'FOB', 'Foto producto', 'Foto 1', 'Foto 2', 'Foto 3', 'Registrado', 'Entrega vendedor', 'Recibido'];

    // Agrupar por cliente (shipping_mark), preservando el orden de aparición
    const groupsMap = new Map();
    selectedPackages.forEach((pkg) => {
      const key = pkg.shipping_mark || pkg.client_email || '—';
      if (!groupsMap.has(key)) groupsMap.set(key, []);
      groupsMap.get(key).push(pkg);
    });

    // Construir AoA (Array of Arrays) — cada elemento es una fila, cada subelemento es una celda
    const aoa = [headers];
    const merges = [];
    const hyperlinks = []; // { row, col, url }
    const totalRows = []; // índices de filas TOTAL FOB para estilo

    const groups = Array.from(groupsMap.entries());
    groups.forEach(([, pkgs], idx) => {
      let groupTotal = 0;

      pkgs.forEach((pkg) => {
        // Foto del producto (subida por el cliente en la pre-alerta)
        const productPhoto = pkg.product_image_url || '';
        // Fotos del paquete al recibirlo (hasta 3)
        const receivedPhotos = Array.isArray(pkg.package_image_urls) && pkg.package_image_urls.length > 0
          ? pkg.package_image_urls.slice(0, 3)
          : (pkg.package_image_url ? [pkg.package_image_url] : []);
        const photo1 = receivedPhotos[0] || '';
        const photo2 = receivedPhotos[1] || '';
        const photo3 = receivedPhotos[2] || '';

        const fobNum = Number(pkg.fob_value) || 0;
        groupTotal += fobNum;

        const row = [
          pkg.shipping_mark || '',
          pkg.tracking_number || '',
          pkg.description || '',
          fobNum,
          productPhoto ? 'Ver foto' : '',
          photo1 ? 'Ver foto' : '',
          photo2 ? 'Ver foto' : '',
          photo3 ? 'Ver foto' : '',
          fmtDate(pkg.created_date),
          fmtDate(pkg.seller_delivery_date),
          fmtDate(pkg.received_date)
        ];
        aoa.push(row);

        const rowIdx = aoa.length - 1;
        if (productPhoto) hyperlinks.push({ row: rowIdx, col: 4, url: productPhoto });
        if (photo1) hyperlinks.push({ row: rowIdx, col: 5, url: photo1 });
        if (photo2) hyperlinks.push({ row: rowIdx, col: 6, url: photo2 });
        if (photo3) hyperlinks.push({ row: rowIdx, col: 7, url: photo3 });
      });

      // Fila TOTAL FOB
      const totalRowIdx = aoa.length;
      aoa.push(['', '', 'TOTAL FOB', groupTotal, '', '', '', '', '', '', '']);
      totalRows.push(totalRowIdx);
      // Merge de las 3 primeras celdas para "TOTAL FOB"
      merges.push({ s: { r: totalRowIdx, c: 0 }, e: { r: totalRowIdx, c: 2 } });

      // Fila vacía entre grupos (no después del último)
      if (idx < groups.length - 1) {
        aoa.push(['', '', '', '', '', '', '', '', '', '', '']);
      }
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Anchos de columna
    ws['!cols'] = [
      { wch: 16 }, // Cliente
      { wch: 28 }, // Tracking
      { wch: 55 }, // Descripcion
      { wch: 10 }, // FOB
      { wch: 13 }, // Foto producto
      { wch: 10 }, // Foto 1
      { wch: 10 }, // Foto 2
      { wch: 10 }, // Foto 3
      { wch: 12 }, // Registrado
      { wch: 16 }, // Entrega vendedor
      { wch: 12 }, // Recibido
    ];

    // Merges
    ws['!merges'] = merges;

    // Hipervínculos en columna Foto
    hyperlinks.forEach(({ row, col, url }) => {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
      if (ws[cellRef]) {
        ws[cellRef].l = { Target: url, Tooltip: 'Abrir foto' };
      }
    });

    // Formato moneda para columna FOB (col 3) — todas las filas excepto el encabezado
    for (let r = 1; r < aoa.length; r++) {
      const cellRef = XLSX.utils.encode_cell({ r, c: 3 });
      if (ws[cellRef] && typeof ws[cellRef].v === 'number') {
        ws[cellRef].z = '"$"#,##0.00';
      }
    }

    // Wrap text en columna Descripción
    for (let r = 1; r < aoa.length; r++) {
      const cellRef = XLSX.utils.encode_cell({ r, c: 2 });
      if (ws[cellRef]) {
        ws[cellRef].s = { alignment: { wrapText: true, vertical: 'top' } };
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pre-alertas');

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const filename = `pre_alertas_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.xlsx`;

    XLSX.writeFile(wb, filename);

    toast.success(`Exportadas ${selectedPackages.length} pre-alertas a Excel`);
  } catch (error) {
    console.error(error);
    toast.error('Error al exportar a Excel');
  }
}