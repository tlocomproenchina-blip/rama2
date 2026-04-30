import { base44 } from '@/components/api/ApiQueueManager';
import { toast } from 'sonner';

/**
 * Exporta todos los paquetes en pre-alerta a un archivo TXT agrupado por shipping mark.
 * Usa exportPaginated para descargar el dataset completo desde el backend.
 */
export async function exportPreAlerta({ onProgress } = {}) {
  try {
    const { exportPaginated } = await import('@/lib/exportPaginated');
    const preAlertaPkgs = await exportPaginated(
      'listPackagesForSupport',
      { statusFilter: 'pre_alerta' },
      { onProgress, label: 'Descargando paquetes pre-alerta' }
    );

    if (preAlertaPkgs.length === 0) {
      toast.error('No hay paquetes en pre-alerta para exportar');
      onProgress?.(null);
      return;
    }

    onProgress?.({ total: preAlertaPkgs.length, remaining: 0, label: 'Generando archivo...' });

    // Cargar usuarios paginados para resolver shipping marks
    const userMap = {};
    let userSkip = 0;
    const USER_BATCH = 500;
    while (true) {
      const usersBatch = await base44.entities.User.list('-updated_date', USER_BATCH, userSkip);
      if (!usersBatch || usersBatch.length === 0) break;
      usersBatch.forEach(u => { userMap[u.email] = u; });
      if (usersBatch.length < USER_BATCH) break;
      userSkip += USER_BATCH;
      if (userSkip > 50000) break;
    }

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
      pkgs.forEach(pkg => { content += `${pkg.tracking_number}\n`; });
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

    toast.success(`Exportado ${preAlertaPkgs.length} paquetes`);
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

    const headers = ['Cliente', 'Numero de tracking', 'Descripcion', 'Foto'];

    const rows = selectedPackages.map((pkg) => {
      const photo = (Array.isArray(pkg.package_image_urls) && pkg.package_image_urls[0])
        || pkg.package_image_url
        || pkg.product_image_url
        || pkg.invoice_url
        || '';
      return [
        pkg.shipping_mark || '',
        pkg.tracking_number || '',
        pkg.description || '',
        photo,
      ];
    });

    const aoa = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Forzar tracking como texto (evita notación científica)
    rows.forEach((_, idx) => {
      const cellRef = XLSX.utils.encode_cell({ r: idx + 1, c: 1 });
      if (ws[cellRef]) {
        ws[cellRef].t = 's';
        ws[cellRef].z = '@';
      }
    });

    // Convertir columna Foto en hipervínculos clickeables "Ver foto"
    rows.forEach((row, idx) => {
      const photo = row[3];
      const cellRef = XLSX.utils.encode_cell({ r: idx + 1, c: 3 });
      if (photo && ws[cellRef]) {
        ws[cellRef].v = 'Ver foto';
        ws[cellRef].l = { Target: photo, Tooltip: 'Abrir foto' };
      }
    });

    // Anchos de columna
    ws['!cols'] = [{ wch: 18 }, { wch: 24 }, { wch: 40 }, { wch: 14 }];

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