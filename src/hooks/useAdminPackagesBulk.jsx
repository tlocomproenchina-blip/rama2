import { useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { toast } from 'sonner';

/**
 * Hook para gestionar acciones masivas (bulk) sobre paquetes:
 * selección, eliminación, cambio de estado y marcado como reportado.
 */
export function useAdminPackagesBulk({ packages, onReload, patchPackageInList, removePackageFromList }) {
  const [selectedPackages, setSelectedPackages] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null);

  const handleSelectAll = (checked, visiblePackages) => {
    if (checked) {
      setSelectedPackages(visiblePackages.map(p => p.id));
    } else {
      setSelectedPackages([]);
    }
  };

  const handleSelectPackage = (pkgId, checked) => {
    if (checked) {
      setSelectedPackages(prev => [...prev, pkgId]);
    } else {
      setSelectedPackages(prev => prev.filter(id => id !== pkgId));
    }
  };

  const handleBulkAction = () => {
    if (!bulkAction) {
      toast.error('Selecciona una acción');
      return;
    }
    if (selectedPackages.length === 0) {
      toast.error('Selecciona al menos un paquete');
      return;
    }
    if (bulkAction === 'status' && !bulkStatus) {
      toast.error('Selecciona un estado');
      return;
    }
    setShowBulkConfirm(true);
  };

  const executeBulkAction = async () => {
    setBulkProcessing(true);
    const selectedPkgs = packages.filter(p => selectedPackages.includes(p.id));
    const total = selectedPkgs.length;
    setBulkProgress({ total, remaining: total });
    try {
      const batchSize = 10;

      if (bulkAction === 'delete') {
        for (let i = 0; i < selectedPkgs.length; i += batchSize) {
          const batch = selectedPkgs.slice(i, i + batchSize);
          await Promise.all(batch.map(pkg => base44.entities.Package.delete(pkg.id)));
          // Update optimista: remover del listado
          batch.forEach(pkg => removePackageFromList?.(pkg.id));
          setBulkProgress({ total, remaining: total - (i + batch.length) });
        }
        toast.success(`${total} paquetes eliminados`);
      } else if (bulkAction === 'status') {
        for (let i = 0; i < selectedPkgs.length; i += batchSize) {
          const batch = selectedPkgs.slice(i, i + batchSize);
          await Promise.all(batch.map(pkg => base44.entities.Package.update(pkg.id, { status: bulkStatus })));
          // Update optimista por paquete
          batch.forEach(pkg => patchPackageInList?.(pkg.id, { status: bulkStatus }));
          setBulkProgress({ total, remaining: total - (i + batch.length) });
        }

        if (['en_transito', 'disponible', 'entregado'].includes(bulkStatus)) {
          const { notifyPackageStatus } = await import('@/components/NotificationUtils');
          for (let i = 0; i < selectedPkgs.length; i += batchSize) {
            const batch = selectedPkgs.slice(i, i + batchSize);
            await Promise.all(batch.map(pkg => notifyPackageStatus(pkg, bulkStatus)));
          }
        }

        toast.success(`${total} paquetes actualizados`);
      }

      setSelectedPackages([]);
      setBulkAction('');
      setBulkStatus('');
      setShowBulkConfirm(false);
    } catch (error) {
      toast.error('Error al ejecutar acción masiva');
      onReload?.(); // refetch sólo si falló para reconciliar estado
    }
    setBulkProgress(null);
    setBulkProcessing(false);
  };

  const handleCopySelectedByMark = async () => {
    try {
      const selectedPkgs = packages.filter(p => selectedPackages.includes(p.id));
      if (selectedPkgs.length === 0) { toast.error('Selecciona al menos un paquete'); return; }
      const groups = new Map();
      selectedPkgs.forEach(p => {
        const mark = (p.shipping_mark || 'N/A').trim();
        if (!groups.has(mark)) groups.set(mark, []);
        groups.get(mark).push(p);
      });
      const marks = Array.from(groups.keys()).sort();
      let content = '';
      marks.forEach((mark, idx) => {
        content += `Shipping Mark\n${mark}\nTracking Number\n`;
        groups.get(mark).forEach(pkg => {
          const desc = (pkg.description && String(pkg.description).trim()) ? String(pkg.description).replace(/\r?\n/g, ' ') : 'Sin descripción';
          const packageCount = pkg.package_count ? `${pkg.package_count} bulto(s)` : 'Sin bultos';
          content += `${pkg.tracking_number}\n${packageCount}\n${desc}\n`;
        });
        if (idx < marks.length - 1) content += `\n`;
      });
      await navigator.clipboard.writeText(content.trim());
      toast.success(`Copiado ${selectedPkgs.length} tracking(s) en ${marks.length} grupo(s)`);
    } catch (_) {
      toast.error('No se pudo copiar');
    }
  };

  const handleMarkReported = async (flag) => {
    if (selectedPackages.length === 0) { toast.error('Selecciona al menos un paquete'); return; }
    const ids = [...selectedPackages];
    const total = ids.length;
    setBulkProgress({ total, remaining: total });
    try {
      const batchSize = 10;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        await Promise.all(batch.map(id => base44.entities.Package.update(id, { reported: flag })));
        // Update optimista
        batch.forEach(id => patchPackageInList?.(id, { reported: flag }));
        setBulkProgress({ total, remaining: total - (i + batch.length) });
      }
      toast.success(flag ? `${total} marcados como reportados` : `${total} reporte(s) removido(s)`);
      setSelectedPackages([]);
    } catch (e) {
      toast.error('No se pudo actualizar algunos paquetes');
      onReload?.(); // refetch sólo si falló para reconciliar estado
    }
    setBulkProgress(null);
  };

  return {
    selectedPackages, setSelectedPackages,
    bulkAction, setBulkAction,
    bulkStatus, setBulkStatus,
    showBulkConfirm, setShowBulkConfirm,
    bulkProcessing,
    bulkProgress, setBulkProgress,
    handleSelectAll,
    handleSelectPackage,
    handleBulkAction,
    executeBulkAction,
    handleCopySelectedByMark,
    handleMarkReported,
  };
}