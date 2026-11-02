import { useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { toast } from 'sonner';
import { runBatched } from '@/lib/bulkBatches';

// Tamaño de lote y pausa entre lotes: con selecciones grandes (40, 50, 100
// paquetes) el envío en ráfaga hacía que las últimas actualizaciones fallaran.
const CHUNK_SIZE = 5;
const PAUSE_MS = 300;

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
  const [bulkResult, setBulkResult] = useState(null);

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
    if (bulkAction === 'status' && bulkStatus === 'despachado') {
      toast.error('El estado "despachado" solo se asigna desde la herramienta de despacho (escáner).');
      return;
    }
    setShowBulkConfirm(true);
  };

  // Ejecuta la acción sobre la lista de paquetes indicada, lote a lote y sin
  // abortar el resto cuando alguno falla.
  const runBulk = async (action, status, pkgs) => {
    if (!pkgs.length) return;
    const total = pkgs.length;
    const totalBatches = Math.ceil(total / CHUNK_SIZE);
    const label = action === 'delete' ? 'Eliminando paquetes' : 'Actualizando estado';
    const buildProgress = (done, extraLabel) => ({
      total,
      remaining: Math.max(0, total - done),
      currentBatch: Math.min(totalBatches, Math.floor(done / CHUNK_SIZE) + 1),
      totalBatches,
      batchSize: CHUNK_SIZE,
      label: extraLabel || label,
    });

    setBulkProcessing(true);
    setBulkResult(null);
    setBulkProgress(buildProgress(0));

    try {
      const { ok, failed } = await runBatched(
        pkgs,
        async (pkg) => {
          if (action === 'delete') {
            await base44.entities.Package.delete(pkg.id);
            removePackageFromList?.(pkg.id);
          } else {
            await base44.entities.Package.update(pkg.id, { status });
            patchPackageInList?.(pkg.id, { status });
          }
        },
        {
          chunkSize: CHUNK_SIZE,
          pauseMs: PAUSE_MS,
          retries: 1,
          retryDelayMs: 2000,
          onProgress: ({ done }) => setBulkProgress(buildProgress(done)),
        }
      );

      // Notificaciones solo para los paquetes que sí se actualizaron.
      if (action === 'status' && ok.length && ['en_transito', 'disponible', 'entregado'].includes(status)) {
        const { notifyPackageStatus } = await import('@/components/NotificationUtils');
        await runBatched(
          ok,
          (pkg) => notifyPackageStatus(pkg, status),
          {
            chunkSize: 4,
            pauseMs: PAUSE_MS,
            retries: 0,
            onProgress: ({ done }) => setBulkProgress(buildProgress(done, 'Enviando notificaciones')),
          }
        );
      }

      setBulkProgress(null);
      setBulkProcessing(false);
      setShowBulkConfirm(false);

      if (failed.length) {
        const failedPkgs = failed.map(f => f.item);
        setBulkResult({
          action,
          status,
          total,
          okCount: ok.length,
          failedPkgs,
          failed: failed.map(f => ({
            id: f.item.id,
            tracking_number: f.item.tracking_number || '',
            error: f.error?.message || 'No se pudo actualizar',
          })),
        });
        // La selección queda solo con lo pendiente, para reintentar a mano.
        setSelectedPackages(failedPkgs.map(p => p.id));
        toast.error(`${ok.length} de ${total} procesados. ${failed.length} quedaron pendientes.`);
        onReload?.(); // reconciliar la lista con lo que sí quedó guardado
      } else {
        setSelectedPackages([]);
        setBulkAction('');
        setBulkStatus('');
        if (action === 'delete') toast.success(`${ok.length} paquetes eliminados`);
        else toast.success(`${ok.length} paquetes actualizados`);
      }
    } catch (error) {
      setBulkProgress(null);
      setBulkProcessing(false);
      setShowBulkConfirm(false);
      toast.error(error?.message || 'Error al ejecutar acción masiva');
      onReload?.();
    }
  };

  const executeBulkAction = async () => {
    const selectedPkgs = packages.filter(p => selectedPackages.includes(p.id));
    await runBulk(bulkAction, bulkStatus, selectedPkgs);
  };

  const retryBulkFailed = async () => {
    const pending = bulkResult?.failedPkgs || [];
    if (!pending.length) return;
    const { action, status } = bulkResult;
    setBulkResult(null);
    await runBulk(action, status, pending);
  };

  const dismissBulkResult = () => {
    setBulkResult(null);
    setSelectedPackages([]);
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
    const pkgs = packages.filter(p => ids.includes(p.id)).map(p => ({ id: p.id, tracking_number: p.tracking_number }));
    const total = (pkgs.length || ids.length);
    const totalBatches = Math.ceil(total / CHUNK_SIZE);
    const label = flag ? 'Marcando como reportados' : 'Quitando marca de reportados';
    const buildProgress = (done) => ({
      total,
      remaining: Math.max(0, total - done),
      currentBatch: Math.min(totalBatches, Math.floor(done / CHUNK_SIZE) + 1),
      totalBatches,
      batchSize: CHUNK_SIZE,
      label,
    });

    setBulkResult(null);
    setBulkProgress(buildProgress(0));
    try {
      const { ok, failed } = await runBatched(
        pkgs,
        async (item) => {
          await base44.entities.Package.update(item.id, { reported: flag });
          patchPackageInList?.(item.id, { reported: flag });
        },
        {
          chunkSize: CHUNK_SIZE,
          pauseMs: PAUSE_MS,
          retries: 1,
          retryDelayMs: 2000,
          onProgress: ({ done }) => setBulkProgress(buildProgress(done)),
        }
      );
      setBulkProgress(null);
      if (failed.length) {
        setBulkResult({
          action: 'reported',
          status: null,
          total,
          okCount: ok.length,
          failedPkgs: failed.map(f => f.item),
          failed: failed.map(f => ({
            id: f.item.id,
            tracking_number: f.item.tracking_number || '',
            error: f.error?.message || 'No se pudo actualizar',
          })),
        });
        toast.error(`${ok.length} de ${total} actualizados. ${failed.length} quedaron pendientes.`);
        onReload?.();
      } else {
        toast.success(flag ? `${ok.length} marcados como reportados` : `${ok.length} reporte(s) removido(s)`);
        setSelectedPackages([]);
      }
    } catch (e) {
      setBulkProgress(null);
      toast.error('No se pudo actualizar algunos paquetes');
      onReload?.();
    }
  };

  return {
    selectedPackages, setSelectedPackages,
    bulkAction, setBulkAction,
    bulkStatus, setBulkStatus,
    showBulkConfirm, setShowBulkConfirm,
    bulkProcessing,
    bulkProgress, setBulkProgress,
    bulkResult, retryBulkFailed, dismissBulkResult,
    handleSelectAll,
    handleSelectPackage,
    handleBulkAction,
    executeBulkAction,
    handleCopySelectedByMark,
    handleMarkReported,
  };
}