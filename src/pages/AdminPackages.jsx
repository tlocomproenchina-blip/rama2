import React, { useState, useMemo, useEffect } from 'react';
import { uploadImageNoCredits } from '@/lib/imgbbUpload';
import { base44 } from '@/components/api/ApiQueueManager';

import { Button } from "@/components/ui/button";
import BarcodeScannerModule from '@/components/warehouse/BarcodeScannerModule';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import AdvancedSearch from '@/components/admin/AdvancedSearch';
import BulkProgressIndicator from '@/components/admin/packages/BulkProgressIndicator';
import PackagesWindowSummary from '@/components/admin/packages/PackagesWindowSummary';
import ViewImageModal from '@/components/admin/packages/ViewImageModal';
import PackagesMobileList from '@/components/admin/packages/PackagesMobileList';
import RegisterPackageModal from '@/components/admin/RegisterPackageModal';
import PackageImportDialog from '@/components/imports/PackageImportDialog';
import BulkPhotoUploadModal from '@/components/admin/BulkPhotoUploadModal';
import PreAlertEditorModal from '@/components/admin/packages/PreAlertEditorModal';
import ReceivePackageModal from '@/components/admin/packages/ReceivePackageModal';
import EditImageModal from '@/components/admin/packages/EditImageModal';
import CreateTicketModal from '@/components/admin/packages/CreateTicketModal';
import EditPackageModal from '@/components/admin/packages/EditPackageModal';
import BulkActionsBar from '@/components/admin/packages/BulkActionsBar';
import BulkActionConfirmDialog from '@/components/admin/packages/BulkActionConfirmDialog';
import CancelReceptionDialog from '@/components/admin/packages/CancelReceptionDialog';
import PackagesDesktopTable from '@/components/admin/packages/PackagesDesktopTable';
import { useAdminPackagesData } from '@/hooks/useAdminPackagesData';
import { useAdminPackagesBulk } from '@/hooks/useAdminPackagesBulk';
import { exportPreAlerta, exportSelectedToExcel } from '@/components/admin/packages/PackagesExports';

export default function AdminPackages({ user }) {
  const {
    packages,
    loading,
    loadingMore,
    search, setSearch,
    statusFilter, setStatusFilter,
    reportedFilter, setReportedFilter,
    advancedFilters, setAdvancedFilters,
    totalFiltered,
    globalCounts,
    hasMore,
    loadPackages,
    resetFilters,
    patchPackageInList,
    removePackageFromList,
  } = useAdminPackagesData({ pageSize: 50 });

  const bulk = useAdminPackagesBulk({
    packages,
    onReload: () => loadPackages(false),
    patchPackageInList,
    removePackageFromList,
  });
  const {
    selectedPackages,
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
  } = bulk;

  const [receiveModal, setReceiveModal] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [viewImage, setViewImage] = useState(null);
  const [editImageModal, setEditImageModal] = useState(null);
  const [newImageFiles, setNewImageFiles] = useState([]);
  const [ticketModal, setTicketModal] = useState(null);
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketProcessing, setTicketProcessing] = useState(false);
  const [cancelReceptionModal, setCancelReceptionModal] = useState(null);
  const [cancelProcessing, setCancelProcessing] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [bulkPhotoModalOpen, setBulkPhotoModalOpen] = useState(false);
  const [editPreAlertModal, setEditPreAlertModal] = useState(null);
  const [preAlertInsurance, setPreAlertInsurance] = useState(false);
  const [preAlertFobValue, setPreAlertFobValue] = useState('');
  const [preAlertInvoiceFile, setPreAlertInvoiceFile] = useState(null);
  const [editPackageModal, setEditPackageModal] = useState(null);
  const [editPackageProcessing, setEditPackageProcessing] = useState(false);

  // Deep link desde notificaciones: ?packageId=... busca ese tracking
  useEffect(() => {
    const packageId = new URLSearchParams(window.location.search).get('packageId');
    if (!packageId) return;
    (async () => {
      try {
        const pkg = await base44.entities.Package.get(packageId);
        if (pkg?.tracking_number) setSearch(pkg.tracking_number);
      } catch {
        toast.error('No se encontró el paquete de la notificación');
      }
    })();
  }, []);

  const [deletePackageProcessing, setDeletePackageProcessing] = useState(false);

  const handleDeletePackage = async () => {
    if (!editPackageModal) return;
    setDeletePackageProcessing(true);
    try {
      await base44.entities.Package.delete(editPackageModal.id);
      removePackageFromList?.(editPackageModal.id);
      loadPackages(false);
      toast.success('Paquete eliminado');
      setEditPackageModal(null);
    } catch (error) {
      console.error('Error deleting package:', error);
      toast.error(error?.message || 'No se pudo eliminar el paquete');
    }
    setDeletePackageProcessing(false);
  };

  const handleSavePackageEdit = async (patch) => {
    if (!editPackageModal) return;
    if (!patch.tracking_number) {
      toast.error('El tracking es obligatorio');
      return;
    }
    setEditPackageProcessing(true);
    try {
      const newTracking = patch.tracking_number.trim();
      const oldTracking = (editPackageModal.tracking_number || '').trim();
      if (newTracking !== oldTracking) {
        const existing = await base44.entities.Package.filter({ tracking_number: newTracking }, '-created_date', 1);
        if (existing?.length > 0) {
          toast.error('Ese tracking ya está registrado en otro paquete');
          setEditPackageProcessing(false);
          return;
        }
      }
      await base44.entities.Package.update(editPackageModal.id, patch);
      patchPackageInList(editPackageModal.id, patch);
      toast.success('Paquete actualizado');
      setEditPackageModal(null);
    } catch (error) {
      console.error('Error editing package:', error);
      toast.error(error?.message || 'No se pudo actualizar el paquete');
    }
    setEditPackageProcessing(false);
  };

  const handleReceive = async (nextStatus = 'recibido') => {
    if (!receiveModal) return;
    setProcessing(true);

    try {
      let imageUrls = Array.isArray(receiveModal.package_image_urls) ? [...receiveModal.package_image_urls] : (receiveModal.package_image_url ? [receiveModal.package_image_url] : []);
      if (imageFiles && imageFiles.length > 0) {
        const uploaded = [];
        for (const f of imageFiles.slice(0, 3)) {
          const url = await uploadImageNoCredits(f);
          uploaded.push(url);
        }
        imageUrls = uploaded;
      }

      const receivedDate = new Date().toISOString();
      await base44.entities.Package.update(receiveModal.id, {
        status: nextStatus,
        package_image_urls: (imageUrls || []).slice(0,3),
        package_image_url: (imageUrls && imageUrls[0]) ? imageUrls[0] : null,
        received_date: receivedDate,
        received_by: user.email
      });

      // Update optimista en la lista (sin refetch)
      patchPackageInList(receiveModal.id, {
        status: nextStatus,
        package_image_urls: (imageUrls || []).slice(0,3),
        package_image_url: (imageUrls && imageUrls[0]) ? imageUrls[0] : null,
        received_date: receivedDate,
        received_by: user.email,
      });

      if (nextStatus === 'rechazado') {
        // El rechazo sí amerita un aviso inmediato por correo
        const { sendNotification } = await import('@/components/NotificationUtils');
        sendNotification({
          to: receiveModal.client_email,
          subject: '⛔ Tu paquete fue rechazado',
          body: `Tu paquete con tracking ${receiveModal.tracking_number} fue recibido en nuestro almacén, pero fue rechazado y no podrá exportarse. Hemos guardado evidencia fotográfica de la recepción. Si deseas enviarlo a otra dirección, por favor comunícate con soporte para ayudarte con el proceso.`,
          type: 'package',
          icon: 'alert',
          referenceId: receiveModal.id
        });
      } else {
        // Recepción normal: SOLO notificación in-app (sin email).
        // El cliente recibe un único correo diario con el resumen de lo recibido (sendDailyReceivedSummary).
        const { sendInAppNotification } = await import('@/components/NotificationUtils');
        sendInAppNotification({
          user_email: receiveModal.client_email,
          title: '📦 Tu paquete ha sido recibido',
          message: `Tu paquete con tracking ${receiveModal.tracking_number} ha sido recibido en nuestro almacén.`,
          type: 'package',
          icon: 'check',
          reference_id: receiveModal.id,
          entity_type: 'Package',
          priority: 'high'
        });
      }

      toast.success(nextStatus === 'rechazado' ? 'Paquete marcado como rechazado' : 'Paquete marcado como recibido');
      setReceiveModal(null);
      setImageFiles([]);
    } catch (error) {
      console.error('Error receiving package:', error);
      toast.error(error?.message || 'Error al procesar la recepción');
    }
    setProcessing(false);
  };

  const handleUpdateImage = async () => {
    if (!editImageModal || !newImageFiles || newImageFiles.length === 0) {
      toast.error('Selecciona una imagen');
      return;
    }
    setProcessing(true);

    try {
      const current = Array.isArray(editImageModal.package_image_urls) ? [...editImageModal.package_image_urls] : (editImageModal.package_image_url ? [editImageModal.package_image_url] : []);
      const uploaded = [];
      for (const f of newImageFiles.slice(0, 3 - current.length)) {
        const url = await uploadImageNoCredits(f);
        uploaded.push(url);
      }
      const merged = [...current, ...uploaded].slice(0,3);
      await base44.entities.Package.update(editImageModal.id, {
        package_image_urls: merged,
        package_image_url: merged[0] || null
      });

      // Update optimista
      patchPackageInList(editImageModal.id, {
        package_image_urls: merged,
        package_image_url: merged[0] || null,
      });

      toast.success('Imagen actualizada');
      setEditImageModal(null);
      setNewImageFiles([]);
    } catch (error) {
      console.error('Error updating image:', error);
      toast.error(error?.message || 'No se pudo actualizar la imagen');
    }
    setProcessing(false);
  };

  const handleStatusChange = async (pkg, newStatus) => {
    // Update optimista inmediato
    patchPackageInList(pkg.id, { status: newStatus });
    try {
      await base44.entities.Package.update(pkg.id, { status: newStatus });

      if (['en_transito', 'disponible', 'entregado'].includes(newStatus)) {
        const { notifyPackageStatus } = await import('@/components/NotificationUtils');
        notifyPackageStatus(pkg, newStatus);
      }

      toast.success('Estado actualizado y cliente notificado');
    } catch (error) {
      // Rollback
      patchPackageInList(pkg.id, { status: pkg.status });
      console.error('Error updating status:', error);
      toast.error(error?.message || 'No se pudo actualizar el estado');
    }
  };

  const handleScanSearch = async (code) => {
    const nextCode = code.trim();
    if (!nextCode) return;
    setSearch(nextCode);
  };

  const openPreAlertEditor = (pkg) => {
    setEditPreAlertModal(pkg);
    setPreAlertInsurance(!!pkg?.has_insurance);
    setPreAlertFobValue(pkg?.fob_value != null ? String(pkg.fob_value) : '');
    setPreAlertInvoiceFile(null);
  };

  const handleSavePreAlertDetails = async () => {
    if (!editPreAlertModal) return;
    setProcessing(true);
    try {
      let invoiceUrl = editPreAlertModal.invoice_url || null;
      if (preAlertInvoiceFile) {
        invoiceUrl = await uploadImageNoCredits(preAlertInvoiceFile);
      }

      const patch = {
        has_insurance: preAlertInsurance,
        fob_value: preAlertFobValue === '' ? null : Number(preAlertFobValue),
        invoice_url: invoiceUrl,
      };
      await base44.entities.Package.update(editPreAlertModal.id, patch);

      // Update optimista
      patchPackageInList(editPreAlertModal.id, patch);

      toast.success('Datos de seguro actualizados');
      setEditPreAlertModal(null);
      setPreAlertInvoiceFile(null);
    } catch (error) {
      console.error('Error saving pre-alert details:', error);
      toast.error(error?.message || 'No se pudieron guardar los datos');
    }
    setProcessing(false);
  };

  const handleCancelReception = async () => {
    if (!cancelReceptionModal) return;
    try {
      setCancelProcessing(true);
      const patch = {
        status: 'pre_alerta',
        received_date: null,
        received_by: null,
        package_image_url: null,
        package_image_urls: []
      };
      await base44.entities.Package.update(cancelReceptionModal.id, patch);

      // Update optimista
      patchPackageInList(cancelReceptionModal.id, patch);

      toast.success('Recepción cancelada');
      setCancelReceptionModal(null);
    } catch (error) {
      console.error('Error cancelling reception:', error);
      toast.error(error?.message || 'No se pudo cancelar la recepción');
    }
    setCancelProcessing(false);
  };

  const handleCreateTicket = (pkg) => {
    setTicketModal(pkg);
    setTicketMessage('');
  };

  const confirmCreateTicket = async () => {
    if (!ticketModal) return;
    try {
      setTicketProcessing(true);
      const ticketNumber = `TKT-${Date.now()}`;
      const firstMessage = {
        sender_email: user.email,
        sender_name: user.full_name || 'Administrador',
        message: ticketMessage?.trim() || `Ticket creado desde Paquetes para el tracking ${ticketModal.tracking_number}`,
        timestamp: new Date().toISOString(),
        is_admin: true
      };

      await base44.entities.SupportTicket.create({
        ticket_number: ticketNumber,
        client_email: ticketModal.client_email,
        subject: `Soporte - Tracking ${ticketModal.tracking_number}`,
        category: 'tracking',
        priority: 'media',
        related_tracking: ticketModal.tracking_number,
        status: 'abierto',
        assigned_to: user.email,
        messages: [firstMessage]
      });

      toast.success('Ticket creado correctamente');
      setTicketModal(null);
      setTicketMessage('');
    } catch (e) {
      toast.error('No se pudo crear el ticket');
    }
    setTicketProcessing(false);
  };

  // Búsqueda y filtros se aplican server-side
  const filteredPackages = packages;

  const simpleWindowSummary = useMemo(() => {
    if (!advancedFilters) return null;
    const email = (advancedFilters.email || '').trim();
    const shippingMark = (advancedFilters.shippingMark || '').trim();
    if (!email && !shippingMark) return null;
    const list = packages.filter(p => {
      const byEmail = email ? (p.client_email || '').toLowerCase().includes(email.toLowerCase()) : false;
      const byMark = shippingMark ? (p.shipping_mark || '').toLowerCase().includes(shippingMark.toLowerCase()) : false;
      return byEmail || byMark;
    });
    const received = list
      .map(p => p.received_date)
      .filter(Boolean)
      .map(d => new Date(d))
      .sort((a,b) => a - b);
    if (received.length === 0) return null;
    const first = received[0];
    const end = new Date(first.getTime() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const remaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
    return { first, end, remaining };
  }, [advancedFilters, packages]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 md:px-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Gestión de Paquetes</h1>
        <p className="text-slate-500">Administra todos los paquetes del sistema</p>
      </div>

      <AdvancedSearch
        type="packages"
        onSearch={setAdvancedFilters}
        onReset={resetFilters}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        reportedFilter={reportedFilter}
        setReportedFilter={setReportedFilter}
        globalCounts={globalCounts}
        onOpenCreate={() => setCreateModalOpen(true)}
        onOpenImport={() => setImportModalOpen(true)}
        onExportPreAlerta={() => exportPreAlerta({ onProgress: setBulkProgress })}
      />

      <BulkProgressIndicator progress={bulkProgress} />

      {selectedPackages.length > 0 && (
        <BulkActionsBar
          selectedCount={selectedPackages.length}
          totalVisible={filteredPackages.length}
          bulkAction={bulkAction}
          setBulkAction={setBulkAction}
          bulkStatus={bulkStatus}
          setBulkStatus={setBulkStatus}
          onApply={handleBulkAction}
          onCancel={() => bulk.setSelectedPackages([])}
          onSelectAll={(checked) => handleSelectAll(checked, filteredPackages)}
          onCopySelectedByMark={handleCopySelectedByMark}
          onMarkReported={handleMarkReported}
          onExportExcel={() => {
            const selectedPkgs = filteredPackages.filter(p => selectedPackages.includes(p.id));
            exportSelectedToExcel(selectedPkgs);
          }}
        />
      )}

      <BarcodeScannerModule
        title="Búsqueda y escaneo de paquetes"
        description="Usa una sola barra para buscar por tracking, shipping mark o email, y también para escanear con cámara o lectora."
        placeholder="Busca o escanea tracking, shipping mark o email"
        actionLabel="Buscar paquete"
        value={search}
        onValueChange={setSearch}
        onDetected={handleScanSearch}
        inputClassName="w-full"
        extraAction={
          <Button
            onClick={() => setBulkPhotoModalOpen(true)}
            variant="outline"
            className="h-11 border-emerald-200 text-emerald-600 hover:bg-emerald-50 gap-2 whitespace-nowrap"
          >
            <ImageIcon className="h-4 w-4" />
            Carga Masiva Fotos
          </Button>
        }
      />

      {totalFiltered > 0 && (
        <div className="text-sm text-slate-500 -mt-2 flex items-center gap-2">
          <span>Mostrando <span className="font-semibold">{packages.length}</span> de <span className="font-semibold">{totalFiltered}</span> paquetes que coinciden</span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-blue-600" />}
        </div>
      )}

      <PackagesWindowSummary summary={simpleWindowSummary} />

      {loading && packages.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )}

      <PackagesMobileList
        packages={filteredPackages}
        selectedPackages={selectedPackages}
        onSelect={handleSelectPackage}
        onCreateTicket={handleCreateTicket}
        onReceive={(pkg) => setReceiveModal(pkg)}
        onViewImage={(url) => setViewImage(url)}
        onEditImage={(pkg) => setEditImageModal(pkg)}
        onCancelReception={(pkg) => setCancelReceptionModal(pkg)}
        onStatusChange={handleStatusChange}
        onEditPackage={(pkg) => setEditPackageModal(pkg)}
      />

      <PackagesDesktopTable
        packages={filteredPackages}
        selectedPackages={selectedPackages}
        onSelectAll={(checked) => handleSelectAll(checked, filteredPackages)}
        onSelectPackage={handleSelectPackage}
        onCreateTicket={handleCreateTicket}
        onOpenPreAlertEditor={openPreAlertEditor}
        onReceive={(pkg) => setReceiveModal(pkg)}
        onViewImage={(url) => setViewImage(url)}
        onEditImage={(pkg) => setEditImageModal(pkg)}
        onCancelReception={(pkg) => setCancelReceptionModal(pkg)}
        onStatusChange={handleStatusChange}
        onEditPackage={(pkg) => setEditPackageModal(pkg)}
      />
      {hasMore && (
        <Button variant="outline" className="w-full mt-4" onClick={() => loadPackages(true, packages.length)} disabled={loadingMore}>
          {loadingMore ? 'Cargando...' : 'Cargar más'}
        </Button>
      )}

      <PreAlertEditorModal
        pkg={editPreAlertModal}
        insurance={preAlertInsurance}
        setInsurance={setPreAlertInsurance}
        fobValue={preAlertFobValue}
        setFobValue={setPreAlertFobValue}
        invoiceFile={preAlertInvoiceFile}
        setInvoiceFile={setPreAlertInvoiceFile}
        processing={processing}
        onClose={() => setEditPreAlertModal(null)}
        onSave={handleSavePreAlertDetails}
      />

      <ReceivePackageModal
        pkg={receiveModal}
        imageFiles={imageFiles}
        setImageFiles={setImageFiles}
        processing={processing}
        onClose={() => setReceiveModal(null)}
        onConfirm={handleReceive}
      />

      <ViewImageModal imageUrl={viewImage} onClose={() => setViewImage(null)} />

      <EditImageModal
        pkg={editImageModal}
        newImageFiles={newImageFiles}
        setNewImageFiles={setNewImageFiles}
        processing={processing}
        onClose={() => { setEditImageModal(null); setNewImageFiles([]); }}
        onSubmit={handleUpdateImage}
      />

      <CreateTicketModal
        pkg={ticketModal}
        message={ticketMessage}
        setMessage={setTicketMessage}
        processing={ticketProcessing}
        onClose={() => { setTicketModal(null); setTicketMessage(''); }}
        onConfirm={confirmCreateTicket}
      />

      <BulkActionConfirmDialog
        open={showBulkConfirm}
        onOpenChange={setShowBulkConfirm}
        bulkAction={bulkAction}
        bulkStatus={bulkStatus}
        selectedCount={selectedPackages.length}
        bulkProcessing={bulkProcessing}
        onConfirm={executeBulkAction}
      />

      <CancelReceptionDialog
        pkg={cancelReceptionModal}
        processing={cancelProcessing}
        onOpenChange={(open) => { if (!open) setCancelReceptionModal(null); }}
        onConfirm={handleCancelReception}
      />

      <RegisterPackageModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onCreated={() => {
          setCreateModalOpen(false);
          loadPackages(false);
        }}
      />

      <PackageImportDialog
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onImported={() => loadPackages(false)}
      />

      <BulkPhotoUploadModal
        open={bulkPhotoModalOpen}
        onOpenChange={setBulkPhotoModalOpen}
        onCompleted={() => loadPackages(false)}
      />

      <EditPackageModal
        pkg={editPackageModal}
        processing={editPackageProcessing}
        deleting={deletePackageProcessing}
        onClose={() => setEditPackageModal(null)}
        onSave={handleSavePackageEdit}
        onDelete={handleDeletePackage}
      />
    </div>
  );
}