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

    // Escapa HTML para evitar romper el documento
    const escapeHtml = (val) => {
      const s = val == null ? '' : String(val);
      return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    };

    const headers = ['Cliente', 'Numero de tracking', 'Descripcion', 'FOB', 'Foto'];

    // Agrupar por cliente (shipping_mark), preservando el orden de aparición
    const groupsMap = new Map();
    selectedPackages.forEach((pkg) => {
      const key = pkg.shipping_mark || pkg.client_email || '—';
      if (!groupsMap.has(key)) groupsMap.set(key, []);
      groupsMap.get(key).push(pkg);
    });

    const emptyRow = `<tr><td colspan="5">&nbsp;</td></tr>`;

    const groupsHtml = Array.from(groupsMap.entries()).map(([, pkgs], idx, arr) => {
      let groupTotal = 0;

      const rows = pkgs.map((pkg) => {
        const photo = (Array.isArray(pkg.package_image_urls) && pkg.package_image_urls[0])
          || pkg.package_image_url
          || pkg.product_image_url
          || pkg.invoice_url
          || '';

        const fobNum = Number(pkg.fob_value) || 0;
        groupTotal += fobNum;
        const fobCell = `<td style="mso-number-format:'\\$#,##0.00';">${fobNum.toFixed(2)}</td>`;

        const trackingCell = `<td style="mso-number-format:'\\@';">${escapeHtml(pkg.tracking_number || '')}</td>`;
        const photoCell = photo
          ? `<td><a href="${escapeHtml(photo)}">Ver foto</a></td>`
          : '<td></td>';

        return `<tr>
          <td>${escapeHtml(pkg.shipping_mark || '')}</td>
          ${trackingCell}
          <td>${escapeHtml(pkg.description || '')}</td>
          ${fobCell}
          ${photoCell}
        </tr>`;
      }).join('');

      const totalRow = `<tr>
        <td colspan="3" style="font-weight:bold; text-align:right;">TOTAL FOB</td>
        <td style="font-weight:bold; mso-number-format:'\\$#,##0.00';">${groupTotal.toFixed(2)}</td>
        <td></td>
      </tr>`;

      // Separador en blanco entre clientes (no después del último)
      return rows + totalRow + (idx < arr.length - 1 ? emptyRow : '');
    }).join('');

    const rowsHtml = groupsHtml;
    const totalRow = '';

    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<!--[if gte mso 9]><xml>
  <x:ExcelWorkbook>
    <x:ExcelWorksheets>
      <x:ExcelWorksheet>
        <x:Name>Pre-alertas</x:Name>
        <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
      </x:ExcelWorksheet>
    </x:ExcelWorksheets>
  </x:ExcelWorkbook>
</xml><![endif]-->
<style>
  table { border-collapse: collapse; }
  th, td { border: 1px solid #999; padding: 4px 6px; vertical-align: top; font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
  th { background: #F2F2F2; font-weight: bold; text-align: center; }
</style>
</head>
<body>
<table border="1">
  <thead>
    <tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr>
  </thead>
  <tbody>${rowsHtml}${totalRow}</tbody>
</table>
</body>
</html>`;

    const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const filename = `pre_alertas_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}.xls`;

    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();

    toast.success(`Exportadas ${selectedPackages.length} pre-alertas a Excel`);
  } catch (error) {
    console.error(error);
    toast.error('Error al exportar a Excel');
  }
}