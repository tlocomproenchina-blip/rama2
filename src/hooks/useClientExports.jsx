import { useState, useCallback } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { toast } from 'sonner';

/**
 * Hook que encapsula la descarga paginada y los dos exports (CSV remarketing y TXT detallado)
 * para AdminClients. Expone el estado de progreso para mostrar BulkProgressIndicator.
 */
export default function useClientExports(filters) {
  const { debouncedSearch, exclusiveKey, stateFilter, fromDate, toDate, quickDate } = filters;
  const [bulkProgress, setBulkProgress] = useState(null);

  const fetchAllFilteredClients = useCallback(async (onProgress) => {
    const baseParams = {
      q: debouncedSearch, exclusiveKey, stateFilter, fromDate, toDate, quickDate,
      includeCounts: false,
    };
    const res = await base44.functions.invoke('listClientsForSupport', { limit: 200, skip: 0, ...baseParams });
    let all = res?.data?.data || [];
    let total = res?.data?.total || all.length;
    onProgress?.({ total, remaining: Math.max(0, total - all.length), label: 'Descargando clientes' });
    while (all.length < total) {
      const more = await base44.functions.invoke('listClientsForSupport', { limit: 200, skip: all.length, ...baseParams });
      const batch = more?.data?.data || [];
      if (batch.length === 0) break;
      all = all.concat(batch);
      onProgress?.({ total, remaining: Math.max(0, total - all.length), label: 'Descargando clientes' });
    }
    return all;
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
      const lines = [];
      all.forEach((client, index) => {
        const fullName = `${client.first_name || ''} ${client.last_name || ''}`.trim();
        lines.push(`Nombre: ${fullName}`);
        lines.push(`Estado: ${client.state || ''}`);
        lines.push(`Ciudad: ${client.city || ''}`);
        lines.push(`Direccion: ${client.address || ''}`);
        lines.push(`WhatsApp: ${client.whatsapp || ''}`);
        lines.push(`Email: ${client.email}`);
        lines.push(`Codigo asignado: ${client.shipping_mark || ''}`);
        if (index < all.length - 1) lines.push('');
      });
      const txtContent = lines.join('\n');
      const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const filterMap = {
        all: 'todos',
        with_mark: 'con_shipping_mark',
        without_mark: 'sin_shipping_mark',
        pending: 'pendientes',
        incomplete: 'con_datos_faltantes',
        active: 'activos',
        inactive: 'inactivos',
        with_packages: 'con_paquetes',
        without_packages: 'sin_paquetes',
        with_whatsapp: 'con_whatsapp',
        without_whatsapp: 'sin_whatsapp',
      };
      const filterLabel = filterMap[exclusiveKey] || 'seleccion';

      const now = new Date();
      const veFmt = new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
      const [dd, mm, yyyy] = veFmt.split('/');
      const todayStamp = `${yyyy}${mm}${dd}`;

      let dateSuffix = todayStamp;
      if (fromDate || toDate) {
        const fromS = fromDate ? String(fromDate).replaceAll('-', '') : '00000000';
        const toS = toDate ? String(toDate).replaceAll('-', '') : todayStamp;
        dateSuffix = `${fromS}_${toS}`;
      } else if (quickDate === 'today') {
        dateSuffix = `${todayStamp}_hoy`;
      } else if (quickDate === '7d') {
        dateSuffix = `${todayStamp}_ultimos_7d`;
      } else if (quickDate === '30d') {
        dateSuffix = `${todayStamp}_ultimos_30d`;
      }

      link.download = `clientes_${filterLabel}_${dateSuffix}.txt`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`${lines.filter((l) => l.startsWith('Email:')).length} clientes exportados a TXT`);
    } catch (error) {
      toast.error('Error al exportar datos');
    }
    setBulkProgress(null);
  }, [fetchAllFilteredClients, exclusiveKey, fromDate, toDate, quickDate]);

  return { bulkProgress, handleExportRemarketing, handleExportFiltered };
}