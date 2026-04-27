import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { base44 as directBase44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BarcodeScannerModule from '@/components/warehouse/BarcodeScannerModule';
import { 
  Package, 
  CheckCircle,
  Image as ImageIcon,
  Loader2,
  Upload,
  Eye,
  Plane,
  Ship,
  Shield,
  Download,
  Copy,
  Flag,
  FlagOff,
  MessageSquare,
  Undo2
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import AdvancedSearch from '@/components/admin/AdvancedSearch';
import RegisterPackageModal from '@/components/admin/RegisterPackageModal';
import PackageImportDialog from '@/components/imports/PackageImportDialog';
import BulkPhotoUploadModal from '@/components/admin/BulkPhotoUploadModal';
import MobilePackageCard from '@/components/admin/MobilePackageCard';
import PreAlertEditorModal from '@/components/admin/packages/PreAlertEditorModal';
import ReceivePackageModal from '@/components/admin/packages/ReceivePackageModal';
import EditImageModal from '@/components/admin/packages/EditImageModal';
import CreateTicketModal from '@/components/admin/packages/CreateTicketModal';
import BulkActionsBar from '@/components/admin/packages/BulkActionsBar';
import BulkActionConfirmDialog from '@/components/admin/packages/BulkActionConfirmDialog';
import CancelReceptionDialog from '@/components/admin/packages/CancelReceptionDialog';

export default function AdminPackages({ user }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reportedFilter, setReportedFilter] = useState('all');
  const [totalFiltered, setTotalFiltered] = useState(0);
  const [globalCounts, setGlobalCounts] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [receiveModal, setReceiveModal] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [viewImage, setViewImage] = useState(null);
  const [advancedFilters, setAdvancedFilters] = useState(null);
  const [selectedPackages, setSelectedPackages] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [editImageModal, setEditImageModal] = useState(null);
  const [newImageFiles, setNewImageFiles] = useState([]);
  const [ticketModal, setTicketModal] = useState(null);
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketProcessing, setTicketProcessing] = useState(false);
  const [cancelReceptionModal, setCancelReceptionModal] = useState(null);
  const [cancelProcessing, setCancelProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null); // { total, remaining }
  const pageSize = 50;
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [bulkPhotoModalOpen, setBulkPhotoModalOpen] = useState(false);
  const [editPreAlertModal, setEditPreAlertModal] = useState(null);
  const [preAlertInsurance, setPreAlertInsurance] = useState(false);
  const [preAlertFobValue, setPreAlertFobValue] = useState('');
  const [preAlertInvoiceFile, setPreAlertInvoiceFile] = useState(null);

  const loadPackages = useCallback(async (append = false, skipOverride = 0) => {
    if (append) setLoadingMore(true); else setLoading(true);
    const skip = append ? skipOverride : 0;
    try {
      const res = await base44.functions.invoke('listPackagesForSupport', {
        limit: pageSize,
        skip,
        q: debouncedSearch,
        statusFilter,
        reportedFilter,
        advancedFilters,
        includeCounts: !append, // counts solo en primera página
      });
      const pkgs = res?.data?.data || [];
      const total = res?.data?.total || 0;
      const counts = res?.data?.counts;
      if (append) {
        setPackages(prev => [...prev, ...pkgs]);
      } else {
        setPackages(pkgs);
        setTotalFiltered(total);
        if (counts) setGlobalCounts(counts);
      }
      setHasMore(res?.data?.hasMore || false);
    } catch (e) {
      console.error('Error loading packages:', e);
      toast.error('Error al cargar paquetes');
    }
    if (append) setLoadingMore(false); else setLoading(false);
  }, [debouncedSearch, statusFilter, reportedFilter, advancedFilters, pageSize]);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Recargar cuando cambien filtros o búsqueda
  useEffect(() => {
    loadPackages(false);
  }, [loadPackages]);

  const handleReceive = async (nextStatus = 'recibido') => {
    if (!receiveModal) return;
    setProcessing(true);

    try {
      let imageUrls = Array.isArray(receiveModal.package_image_urls) ? [...receiveModal.package_image_urls] : (receiveModal.package_image_url ? [receiveModal.package_image_url] : []);
      if (imageFiles && imageFiles.length > 0) {
        const uploaded = [];
        for (const f of imageFiles.slice(0, 3)) {
          const { file_url } = await directBase44.integrations.Core.UploadFile({ file: f });
          uploaded.push(file_url);
        }
        imageUrls = uploaded;
      }

      await base44.entities.Package.update(receiveModal.id, {
        status: nextStatus,
        package_image_urls: (imageUrls || []).slice(0,3),
        package_image_url: (imageUrls && imageUrls[0]) ? imageUrls[0] : null,
        received_date: new Date().toISOString(),
        received_by: user.email
      });

      const { sendNotification } = await import('@/components/NotificationUtils');
      if (nextStatus === 'rechazado') {
        sendNotification({
          to: receiveModal.client_email,
          subject: '⛔ Tu paquete fue rechazado',
          body: `Tu paquete con tracking ${receiveModal.tracking_number} fue recibido en nuestro almacén, pero fue rechazado y no podrá exportarse. Hemos guardado evidencia fotográfica de la recepción. Si deseas enviarlo a otra dirección, por favor comunícate con soporte para ayudarte con el proceso.`,
          type: 'package',
          icon: 'alert',
          referenceId: receiveModal.id
        });
      } else {
        sendNotification({
          to: receiveModal.client_email,
          subject: '📦 Tu paquete ha sido recibido',
          body: `¡Buenas noticias! Tu paquete con tracking ${receiveModal.tracking_number} ha sido recibido en nuestro almacén.\n\nPronto será procesado para consolidación.`,
          type: 'package',
          icon: 'check',
          referenceId: receiveModal.id
        });
      }

      toast.success(nextStatus === 'rechazado' ? 'Paquete marcado como rechazado' : 'Paquete marcado como recibido');
      setReceiveModal(null);
      setImageFiles([]);
      loadPackages(false);
    } catch (error) {
      toast.error('Error al procesar');
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
        const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
        uploaded.push(file_url);
      }
      const merged = [...current, ...uploaded].slice(0,3);
      await base44.entities.Package.update(editImageModal.id, {
        package_image_urls: merged,
        package_image_url: merged[0] || null
      });

      toast.success('Imagen actualizada');
      setEditImageModal(null);
      setNewImageFiles([]);
      loadPackages(false);
    } catch (error) {
      toast.error('Error al actualizar imagen');
    }
    setProcessing(false);
  };

  const handleStatusChange = async (pkg, newStatus) => {
    await base44.entities.Package.update(pkg.id, { status: newStatus });
    
    // Notify client
    if (['en_transito', 'disponible', 'entregado'].includes(newStatus)) {
      const { notifyPackageStatus } = await import('@/components/NotificationUtils');
      notifyPackageStatus(pkg, newStatus);
    }
    
    toast.success('Estado actualizado y cliente notificado');
    loadPackages(false);
  };

  const handleAdvancedSearch = (filters) => {
    setAdvancedFilters(filters);
  };

  const handleResetFilters = () => {
    setAdvancedFilters(null);
    setSearch('');
    setStatusFilter('all');
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedPackages(filteredPackages.map(p => p.id));
    } else {
      setSelectedPackages([]);
    }
  };

  const handleSelectPackage = (pkgId, checked) => {
    if (checked) {
      setSelectedPackages([...selectedPackages, pkgId]);
    } else {
      setSelectedPackages(selectedPackages.filter(id => id !== pkgId));
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
          setBulkProgress({ total, remaining: total - (i + batch.length) });
        }
        toast.success(`${total} paquetes eliminados`);
      } else if (bulkAction === 'status') {
        for (let i = 0; i < selectedPkgs.length; i += batchSize) {
          const batch = selectedPkgs.slice(i, i + batchSize);
          await Promise.all(batch.map(pkg => base44.entities.Package.update(pkg.id, { status: bulkStatus })));
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
      loadPackages(false);
    } catch (error) {
      toast.error('Error al ejecutar acción masiva');
    }
    setBulkProgress(null);
    setBulkProcessing(false);
  };

  const handleExportPreAlerta = async () => {
    try {
      // Pedir al backend TODOS los pre-alerta (no solo los de la página actual)
      toast.info('Preparando exportación...');
      const preAlertaPkgs = [];
      let skip = 0;
      const BATCH = 200;
      while (true) {
        const res = await base44.functions.invoke('listPackagesForSupport', {
          limit: BATCH,
          skip,
          statusFilter: 'pre_alerta',
          includeCounts: false,
        });
        const batch = res?.data?.data || [];
        preAlertaPkgs.push(...batch);
        if (batch.length < BATCH) break;
        skip += BATCH;
        if (skip > 20000) break;
      }

      if (preAlertaPkgs.length === 0) {
        toast.error('No hay paquetes en pre-alerta para exportar');
        return;
      }

      // Get all users for shipping marks
      const users = await base44.entities.User.list();
      const userMap = {};
      users.forEach(u => {
        userMap[u.email] = u;
      });

      // Group by client email
      const clientMap = {};
      preAlertaPkgs.forEach(pkg => {
        if (!clientMap[pkg.client_email]) {
          clientMap[pkg.client_email] = [];
        }
        clientMap[pkg.client_email].push(pkg);
      });

      // Generate text content
      let content = '';
      const clients = Object.keys(clientMap).sort();
      
      clients.forEach((email, index) => {
        const pkgs = clientMap[email];
        const shippingMark = userMap[email]?.shipping_mark || 'N/A';
        
        content += `Cliente \n${shippingMark}\ntracking Number\n`;
        pkgs.forEach(pkg => {
          content += `${pkg.tracking_number}\n`;
        });
        
        // Add blank line between clients except for last one
        if (index < clients.length - 1) {
          content += '\n\n';
        }
      });

      // Create and download file
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
        setBulkProgress({ total, remaining: total - (i + batch.length) });
      }
      toast.success(flag ? `${total} marcados como reportados` : `${total} reporte(s) removido(s)`);
      setSelectedPackages([]);
      loadPackages(false);
    } catch (e) {
      toast.error('No se pudo actualizar algunos paquetes');
      loadPackages(false);
    }
    setBulkProgress(null);
  };

  const handleCreateTicket = (pkg) => {
    setTicketModal(pkg);
    setTicketMessage('');
  };

  const handleScanSearch = async (code) => {
    const nextCode = code.trim();
    if (!nextCode) return;
    // El backend se encarga de buscar (tracking, shipping_mark, email, descripción y nombre del cliente)
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
        const { file_url } = await base44.integrations.Core.UploadFile({ file: preAlertInvoiceFile });
        invoiceUrl = file_url;
      }

      await base44.entities.Package.update(editPreAlertModal.id, {
        has_insurance: preAlertInsurance,
        fob_value: preAlertFobValue === '' ? null : Number(preAlertFobValue),
        invoice_url: invoiceUrl,
      });

      toast.success('Datos de seguro actualizados');
      setEditPreAlertModal(null);
      setPreAlertInvoiceFile(null);
      loadPackages(false);
    } catch (_) {
      toast.error('No se pudo guardar');
    }
    setProcessing(false);
  };

  const handleCancelReception = async () => {
    if (!cancelReceptionModal) return;
    try {
      setCancelProcessing(true);
      await base44.entities.Package.update(cancelReceptionModal.id, {
        status: 'pre_alerta',
        received_date: null,
        received_by: null,
        package_image_url: null,
        package_image_urls: []
      });
      toast.success('Recepción cancelada');
      setCancelReceptionModal(null);
      loadPackages(false);
    } catch (_) {
      toast.error('No se pudo cancelar la recepción');
    }
    setCancelProcessing(false);
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

  // Búsqueda y filtros se aplican server-side. La lista 'packages' ya viene filtrada.
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

    if (loading && packages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 md:px-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Gestión de Paquetes</h1>
        <p className="text-slate-500">Administra todos los paquetes del sistema</p>
      </div>

      {/* Advanced Search */}
      <AdvancedSearch
        type="packages"
        onSearch={handleAdvancedSearch}
        onReset={handleResetFilters}
      />

      {/* Quick Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex flex-col lg:flex-row gap-4 flex-1 w-full">

              <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full lg:w-auto">
                <TabsList className="flex w-full gap-0 p-1 flex-wrap">
                  <TabsTrigger value="all" className="flex-1 text-center">Todos{globalCounts ? ` (${globalCounts.total})` : ''}</TabsTrigger>
                  <TabsTrigger value="pre_alerta_no_recibido" className="flex-1 text-center">Pre-alerta{globalCounts ? ` (${globalCounts.pre_alerta_no_recibido})` : ''}</TabsTrigger>
                  <TabsTrigger value="recibido" className="flex-1 text-center">Recibido{globalCounts ? ` (${globalCounts.recibido})` : ''}</TabsTrigger>
                  <TabsTrigger value="consolidado" className="flex-1 text-center">Consolidado{globalCounts ? ` (${globalCounts.consolidado})` : ''}</TabsTrigger>
                  <TabsTrigger value="en_transito" className="flex-1 text-center">Tránsito{globalCounts ? ` (${globalCounts.en_transito})` : ''}</TabsTrigger>
                  <TabsTrigger value="entregado" className="flex-1 text-center">Entregado{globalCounts ? ` (${globalCounts.entregado})` : ''}</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="grid w-full grid-cols-3 gap-2 lg:hidden">
                <Button variant={reportedFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setReportedFilter('all')} className="w-full">
                  Todos
                </Button>
                <Button variant={reportedFilter === 'reported' ? 'default' : 'outline'} size="sm" onClick={() => setReportedFilter('reported')} className="w-full">
                  Reportados
                </Button>
                <Button variant={reportedFilter === 'unreported' ? 'default' : 'outline'} size="sm" onClick={() => setReportedFilter('unreported')} className="w-full">
                  No reportados
                </Button>
              </div>

              <div className="hidden lg:block">
                <Select value={reportedFilter} onValueChange={setReportedFilter}>
                  <SelectTrigger className="w-full lg:w-48 bg-white">
                    <SelectValue placeholder="Reporte" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="reported">Reportados</SelectItem>
                    <SelectItem value="unreported">No reportados</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              </div>
            <div className="flex flex-col sm:flex-row items-stretch gap-2 w-full sm:w-auto">
              <Button
                onClick={() => setCreateModalOpen(true)}
                size="sm"
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
              >
                <Package className="h-4 w-4 mr-2" />
                Registrar Paquete
              </Button>
              <Button
                onClick={() => setImportModalOpen(true)}
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
              >
                <Upload className="h-4 w-4 mr-2" />
                Importar
              </Button>

              <Button
                onClick={handleExportPreAlerta}
                variant="outline"
                size="sm"
                className="w-full sm:w-auto border-blue-200 text-blue-600 hover:bg-blue-50"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar Pre-alerta
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Progress Indicator */}
      {bulkProgress && (
        <Card className="border-0 shadow-lg bg-amber-50 animate-pulse">
          <CardContent className="p-4 flex items-center gap-4">
            <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">
                Procesando... {bulkProgress.remaining} de {bulkProgress.total} restantes
              </p>
              <div className="mt-1.5 h-2 w-full bg-amber-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-600 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round(((bulkProgress.total - bulkProgress.remaining) / bulkProgress.total) * 100)}%` }}
                />
              </div>
            </div>
            <span className="text-lg font-bold text-amber-700 tabular-nums">
              {bulkProgress.total - bulkProgress.remaining}/{bulkProgress.total}
            </span>
          </CardContent>
        </Card>
      )}

      {selectedPackages.length > 0 && (
        <BulkActionsBar
          selectedCount={selectedPackages.length}
          totalVisible={filteredPackages.length}
          bulkAction={bulkAction}
          setBulkAction={setBulkAction}
          bulkStatus={bulkStatus}
          setBulkStatus={setBulkStatus}
          onApply={handleBulkAction}
          onCancel={() => setSelectedPackages([])}
          onSelectAll={handleSelectAll}
          onCopySelectedByMark={handleCopySelectedByMark}
          onMarkReported={handleMarkReported}
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

      {/* Resultados info */}
      {totalFiltered > 0 && (
        <div className="text-sm text-slate-500 -mt-2 flex items-center gap-2">
          <span>Mostrando <span className="font-semibold">{packages.length}</span> de <span className="font-semibold">{totalFiltered}</span> paquetes que coinciden</span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-blue-600" />}
        </div>
      )}

      {/* Resumen ventana 7 días (búsqueda por email o shipping mark) */}
      {simpleWindowSummary && (
        <Card className="border-0 shadow-sm bg-amber-50/60">
          <CardContent className="p-4 flex flex-wrap gap-6 text-sm text-slate-700">
            <div>
              <span className="font-medium">Primer recibido:</span>{' '}
              {new Date(simpleWindowSummary.first).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}{' '}
              {new Date(simpleWindowSummary.first).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div>
              <span className="font-medium">Fin ventana (7 días):</span>{' '}
              {new Date(simpleWindowSummary.end).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}{' '}
              {new Date(simpleWindowSummary.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div>
              <span className="font-medium">Días restantes:</span> {simpleWindowSummary.remaining}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mobile Packages List (stacked) */}
      <div className="grid gap-3 2xl:hidden">
        {filteredPackages.map((pkg) => (
          <MobilePackageCard
            key={pkg.id}
            pkg={pkg}
            isSelected={selectedPackages.includes(pkg.id)}
            onSelect={(checked) => handleSelectPackage(pkg.id, checked)}
            onCreateTicket={() => handleCreateTicket(pkg)}
            onReceive={() => setReceiveModal(pkg)}
            onViewImage={(url) => setViewImage(url)}
            onEditImage={() => setEditImageModal(pkg)}
            onCancelReception={() => setCancelReceptionModal(pkg)}
            onStatusChange={(val) => handleStatusChange(pkg, val)}
          />
        ))}
      </div>

      {filteredPackages.length === 0 && (
        <Card className="lg:hidden border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500">No se encontraron paquetes</p>
          </CardContent>
        </Card>
      )}

      {/* Desktop Packages Table */}
      <Card className="hidden 2xl:block border-0 shadow-lg overflow-hidden">
        <div className="overflow-x-visible">
          <table className="w-full table-auto">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left pl-3 pr-2 py-3 font-medium text-slate-600">
                  <Checkbox 
                    checked={selectedPackages.length === filteredPackages.length && filteredPackages.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
                <th className="text-left p-3 font-medium text-slate-600 w-[20%]">Tracking</th>
                <th className="text-left p-3 font-medium text-slate-600 w-[14%]">Shipping Mark</th>
                <th className="text-left p-3 font-medium text-slate-600 w-[8%]">Tipo</th>
                <th className="text-left p-3 font-medium text-slate-600 w-[8%]">Carga</th>
                <th className="text-left p-3 font-medium text-slate-600 w-[6%]">Bultos</th>
                <th className="text-left p-3 font-medium text-slate-600 w-[8%]">Estado</th>
                <th className="text-left p-3 font-medium text-slate-600 w-[10%]">Recepción</th>
                <th className="text-left p-3 font-medium text-slate-600 w-[10%]">Registro</th>
                <th className="text-left pl-2 pr-3 py-3 font-medium text-slate-600 w-[16%]">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPackages.map((pkg) => (
                <tr key={pkg.id} className="hover:bg-slate-50 transition-colors">
                  <td className="pl-3 pr-2 py-3">
                    <Checkbox 
                      checked={selectedPackages.includes(pkg.id)}
                      onCheckedChange={(checked) => handleSelectPackage(pkg.id, checked)}
                    />
                  </td>
                  <td className="pl-3 pr-2 py-3 align-top">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-medium text-slate-800 whitespace-nowrap truncate max-w-[18ch]">{pkg.tracking_number}</span>
                        {pkg.has_insurance && (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            <Shield className="h-3 w-3" />
                          </Badge>
                        )}
                        {pkg.reported ? (
                          <Flag className="h-4 w-4 text-green-600" title="Reportado" />
                        ) : (
                          <FlagOff className="h-4 w-4 text-slate-300" title="No reportado" />
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {pkg.description || 'Sin descripción'}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 align-top font-mono text-slate-600 whitespace-nowrap truncate max-w-[14ch]">{pkg.shipping_mark || '-'}</td>
                  <td className="pl-3 pr-2 py-3">
                    <div className="flex items-center gap-2 text-slate-600">
                      {pkg.shipping_type === 'aereo' 
                        ? <><Plane className="h-4 w-4" /> Aéreo</>
                        : <><Ship className="h-4 w-4" /> Marítimo</>
                      }
                    </div>
                  </td>
                  <td className="pl-3 pr-2 py-3">
                    <Badge variant="outline" className={pkg.risk_category === 'alto_riesgo' ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}>
                      {pkg.risk_category === 'alto_riesgo' ? 'Alto riesgo' : 'General'}
                    </Badge>
                  </td>
                  <td className="pl-3 pr-2 py-3 text-slate-700 font-medium">
                    {pkg.package_count || '-'}
                  </td>
                  <td className="pl-3 pr-2 py-3">
                    <StatusBadge status={pkg.status} size="sm" />
                  </td>
                  <td className="p-4 text-slate-600 text-xs">
                    {pkg.received_date ? (
                      <>
                        <div>{new Date(pkg.received_date).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                        <div className="text-[11px] text-slate-400">{new Date(pkg.received_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </>
                    ) : (
                      <div>-</div>
                    )}
                  </td>
                  <td className="p-4 text-slate-600 text-xs">
                    <div>{new Date(pkg.created_date).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                    <div className="text-[11px] text-slate-400">{new Date(pkg.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td className="pl-2 pr-3 py-3 align-top">
                    <div className="flex min-w-0 w-full flex-col items-stretch gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleCreateTicket(pkg)}
                        className="w-full min-w-0 justify-start gap-1"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Ticket
                      </Button>
                      {pkg.status === 'pre_alerta' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openPreAlertEditor(pkg)}
                            className="w-full min-w-0 justify-start"
                          >
                            <Shield className="h-4 w-4 mr-1" />
                            Seguro / Factura
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => setReceiveModal(pkg)}
                            className="w-full min-w-0 justify-start bg-blue-600 hover:bg-blue-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Recibir
                          </Button>
                        </>
                      )}
                      {pkg.product_image_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setViewImage(pkg.product_image_url)}
                          className="w-full justify-start text-violet-600 hover:text-violet-700 border-violet-200"
                        >
                          <Eye className="h-4 w-4" /> Producto
                        </Button>
                      )}
                      {pkg.package_image_url && (
                        <>
                          <div className="flex flex-wrap gap-1">
                        {(pkg.package_image_urls && pkg.package_image_urls.length > 0 ? pkg.package_image_urls : (pkg.package_image_url ? [pkg.package_image_url] : [])).map((url, idx) => (
                          <Button 
                            key={idx}
                            size="sm" 
                            variant="outline"
                            onClick={() => setViewImage(url)}
                            className="w-full min-w-0 justify-start"
                          >
                            <Eye className="h-4 w-4" /> {idx+1}
                          </Button>
                        ))}
                      </div>
                          {pkg.status === 'recibido' && (
                             <Button 
                               size="sm" 
                               variant="outline"
                               onClick={() => setEditImageModal(pkg)}
                                                                      className="w-full justify-start text-blue-600 hover:text-blue-700"
                                                                    >
                                      <ImageIcon className="h-4 w-4" /> Fotos
                                    </Button>
                                

                           )}
                          </>
                          )}
                          {!pkg.package_image_url && pkg.status === 'recibido' && (
                          <Button 
                           size="sm" 
                           variant="outline"
                           onClick={() => setEditImageModal(pkg)}
                           className="w-full justify-start text-blue-600 hover:text-blue-700"
                          >
                           <Upload className="h-4 w-4 mr-1" />
                           Foto
                          </Button>
                          )}
                          {pkg.status === 'recibido' && (
                          <Button
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={() => setCancelReceptionModal(pkg)}
                                                  className="w-full min-w-0 justify-start gap-1 h-8 px-2 text-xs text-rose-600 hover:text-rose-700 border-rose-200"
                                                >
                           <Undo2 className="h-4 w-4 mr-1" />
                           Cancelar
                          </Button>
                          )}
                          {pkg.status !== 'pre_alerta' && pkg.status !== 'consolidado' && (
                          <Select 
                           value={pkg.status} 
                           onValueChange={(val) => handleStatusChange(pkg, val)}
                          >
                           <SelectTrigger className="w-full h-8 px-2 justify-between gap-1 text-xs [&>span]:leading-none">
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="recibido">Recibido</SelectItem>
                             <SelectItem value="rechazado">Rechazado</SelectItem>
                             <SelectItem value="en_transito">En Tránsito</SelectItem>
                             <SelectItem value="disponible">Disponible</SelectItem>
                             <SelectItem value="entregado">Entregado</SelectItem>
                           </SelectContent>
                          </Select>
                          )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredPackages.length === 0 && (
          <div className="p-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500">No se encontraron paquetes</p>
          </div>
        )}
        </Card>

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

      {/* View Image Modal */}
      <Dialog open={!!viewImage} onOpenChange={() => setViewImage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Foto del Paquete</DialogTitle>
          </DialogHeader>
          <img src={viewImage} alt="Paquete" className="w-full rounded-lg" />
        </DialogContent>
      </Dialog>

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

      {/* Register Package Modal */}
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
    </div>
  );
}