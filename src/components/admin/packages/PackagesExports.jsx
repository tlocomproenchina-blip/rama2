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