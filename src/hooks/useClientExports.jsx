import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { exportPaginated } from '@/lib/exportPaginated';

// Genera el contenido TXT con el mismo formato usado para exportar y copiar
function buildClientsTxt(all) {
  const lines = [];
  all.forEach((client, index) => {
    const fullName = `${client.first_name || ''} ${client.last_name || ''}`.trim();
    lines.push(`Shipping Mark: ${client.shipping_mark || ''}`);
    lines.push(`Nombre: ${fullName}`);
    lines.push(`Cedula: ${client.cedula || ''}`);
    lines.push(`Estado: ${client.state || ''}`);
    lines.push(`Ciudad: ${client.city || ''}`);
    lines.push(`Direccion: ${client.address || ''}`);
    lines.push(`WhatsApp: ${client.whatsapp || ''}`);
    lines.push(`Email: ${client.email}`);
    if (index < all.length - 1) lines.push('');
  });
  return lines.join('\n');
}

/**
 * Hook que encapsula la descarga paginada y los dos exports (CSV remarketing y TXT detallado)
 * para AdminClients. Expone el estado de progreso para mostrar BulkProgressIndicator.
 */
export default function useClientExports(filters) {
  const { debouncedSearch, exclusiveKey, stateFilter, fromDate, toDate, quickDate } = filters;
  const [bulkProgress, setBulkProgress] = useState(null);

  const fetchAllFilteredClients = useCallback(async (onProgress) => {
    return await exportPaginated(
      'listClientsForSupport',
      { q: debouncedSearch, exclusiveKey, stateFilter, fromDate, toDate, quickDate },
      { onProgress, label: 'Descargando clientes' }
    );
  }, [debouncedSearch, exclusiveKey, stateFilter, fromDate, toDate, quickDate]);

  const handleExportRemarketing = useCallback(async () => {
    try {
      const all = await fetchAllFilteredClients((p) => setBulkProgress(p));
      setBulkProgress({ total: all.length, remaining: 0, label: 'Generando archivo...' });
      const rows = [['Teléfono/WhatsApp']];
      all.forEach((client) => { if (client.whatsapp) rows.push([client.whatsapp]); });

      const csvContent = rows.map((row) => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `contactos-remarketing-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success(`${rows.length - 1} contactos exportados`);
    } catch (error) {
      toast.error('Error al exportar datos');
    }
    setBulkProgress(null);
  }, [fetchAllFilteredClients]);

  const handleExportFiltered = useCallback(async () => {
    try {
      const all = await fetchAllFilteredClients((p) => setBulkProgress(p));
      if (all.length === 0) {
        toast.error('No hay clientes para exportar');
        setBulkProgress(null);
        return;
      }
      setBulkProgress({ total: all.length, remaining: 0, label: 'Generando archivo...' });
      const txtContent = buildClientsTxt(all);
      const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Nombre de archivo basado en el rango de fechas seleccionado
      const now = new Date();
      const veFmt = new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
      const [dd, mm, yyyy] = veFmt.split('/');
      const todayStamp = `${yyyy}${mm}${dd}`;

      let fileName = '';
      if (fromDate && toDate) {
        const fromS = String(fromDate).replaceAll('-', '');
        const toS = String(toDate).replaceAll('-', '');
        fileName = `clientes_desde_${fromS}_hasta_${toS}.txt`;
      } else if (fromDate) {
        fileName = `clientes_desde_${String(fromDate).replaceAll('-', '')}.txt`;
      } else if (toDate) {
        fileName = `clientes_hasta_${String(toDate).replaceAll('-', '')}.txt`;
      } else if (quickDate === 'today') {
        fileName = `clientes_hoy_${todayStamp}.txt`;
      } else if (quickDate === '7d') {
        fileName = `clientes_ultimos_7_dias_${todayStamp}.txt`;
      } else if (quickDate === '30d') {
        fileName = `clientes_ultimos_30_dias_${todayStamp}.txt`;
      } else {
        fileName = `clientes_todos_${todayStamp}.txt`;
      }

      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`${all.length} clientes exportados a TXT`);
    } catch (error) {
      toast.error('Error al exportar datos');
    }
    setBulkProgress(null);
  }, [fetchAllFilteredClients, exclusiveKey, fromDate, toDate, quickDate]);

  const handleCopyFiltered = useCallback(async () => {
    try {
      const all = await fetchAllFilteredClients((p) => setBulkProgress(p));
      if (all.length === 0) {
        toast.error('No hay clientes para copiar');
        setBulkProgress(null);
        return;
      }
      setBulkProgress({ total: all.length, remaining: 0, label: 'Copiando al portapapeles...' });
      const txtContent = buildClientsTxt(all);
      await navigator.clipboard.writeText(txtContent);
      toast.success(`${all.length} clientes copiados al portapapeles`);
    } catch (error) {
      toast.error('Error al copiar los datos');
    }
    setBulkProgress(null);
  }, [fetchAllFilteredClients]);

  const handleExportExcel = useCallback(async () => {
    try {
      const all = await fetchAllFilteredClients((p) => setBulkProgress(p));
      if (all.length === 0) {
        toast.error('No hay clientes para exportar');
        setBulkProgress(null);
        return;
      }
      setBulkProgress({ total: all.length, remaining: 0, label: 'Generando Excel...' });
      const XLSX = await import('xlsx');
      const rows = [
        ['登记日期', '客户编号', '联系人', '身份证', '区域', '城市', '详细地址', '联系方式', '邮箱', '备注'],
        ['Fecha de Registro', 'Shipping Mark', 'Nombre', 'Cedula', 'Estado', 'Ciudad', 'Dirección', 'Numero telefonico', 'Email', 'Otros'],
        ...all.map((c) => [
          c.created_date ? new Date(c.created_date).toLocaleDateString('es-VE', { timeZone: 'America/Caracas' }) : '',
          c.shipping_mark || '',
          `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.full_name || '',
          c.cedula || '',
          c.state || '',
          c.city || '',
          c.address || '',
          c.whatsapp || '',
          c.email || '',
          c.notes || '',
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [14, 16, 28, 14, 14, 16, 40, 18, 30, 20].map((wch) => ({ wch }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
      XLSX.writeFile(wb, `clientes_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(`${all.length} clientes exportados a Excel`);
    } catch (error) {
      toast.error('Error al exportar Excel');
    }
    setBulkProgress(null);
  }, [fetchAllFilteredClients]);

  return { bulkProgress, handleExportRemarketing, handleExportFiltered, handleCopyFiltered, handleExportExcel };
}