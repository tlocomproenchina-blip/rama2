import React, { useState, useEffect } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Pagination from "@/components/common/Pagination";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Package, 
  Search, 
  CheckCircle,
  Image as ImageIcon,
  Loader2,
  Upload,
  Eye,
  Plane,
  Ship,
  Shield,
  Trash2,
  Download,
  Copy,
  Flag,
  FlagOff,
  MessageSquare,
  Undo2
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import AdvancedSearch from '@/components/admin/AdvancedSearch';
import RegisterPackageModal from '@/components/admin/RegisterPackageModal';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

export default function AdminPackages({ user }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reportedFilter, setReportedFilter] = useState('all');
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [receiveModal, setReceiveModal] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [viewImage, setViewImage] = useState(null);
  const [advancedFilters, setAdvancedFilters] = useState(null);
  const [selectedPackages, setSelectedPackages] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [editImageModal, setEditImageModal] = useState(null);
  const [newImageFile, setNewImageFile] = useState(null);
  const [ticketModal, setTicketModal] = useState(null);
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketProcessing, setTicketProcessing] = useState(false);
  const [cancelReceptionModal, setCancelReceptionModal] = useState(null);
  const [cancelProcessing, setCancelProcessing] = useState(false);
  const pageSize = 50;
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    loadPackages(page);
  }, [page]);

  const loadPackages = async (pageIndex = 0) => {
    const pkgs = await base44.entities.Package.list('-created_date', pageSize, pageIndex * pageSize);
    setPackages(pkgs);
    setHasNext(pkgs.length === pageSize);
    setLoading(false);
  };

  const handleReceive = async () => {
    if (!receiveModal) return;
    setProcessing(true);

    try {
      let imageUrl = receiveModal.package_image_url;
      if (imageFile) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: imageFile });
        imageUrl = file_url;
      }

      await base44.entities.Package.update(receiveModal.id, {
        status: 'recibido',
        package_image_url: imageUrl,
        received_date: new Date().toISOString(),
        received_by: user.email
      });

      // Notify client
      const { sendNotification } = await import('@/components/NotificationUtils');
      sendNotification({
        to: receiveModal.client_email,
        subject: '📦 Tu paquete ha sido recibido',
        body: `¡Buenas noticias! Tu paquete con tracking ${receiveModal.tracking_number} ha sido recibido en nuestro almacén.\n\nPronto será procesado para consolidación.`,
        type: 'package',
        icon: 'check',
        referenceId: receiveModal.id
      });

      toast.success('Paquete marcado como recibido');
      setReceiveModal(null);
      setImageFile(null);
      loadPackages(page);
    } catch (error) {
      toast.error('Error al procesar');
    }
    setProcessing(false);
  };

  const handleUpdateImage = async () => {
    if (!editImageModal || !newImageFile) {
      toast.error('Selecciona una imagen');
      return;
    }
    setProcessing(true);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: newImageFile });
      
      await base44.entities.Package.update(editImageModal.id, {
        package_image_url: file_url
      });

      toast.success('Imagen actualizada');
      setEditImageModal(null);
      setNewImageFile(null);
      loadPackages(page);
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
    loadPackages(page);
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
    try {
      const selectedPkgs = packages.filter(p => selectedPackages.includes(p.id));

      if (bulkAction === 'delete') {
        await Promise.all(selectedPkgs.map(pkg => 
          base44.entities.Package.delete(pkg.id)
        ));
        toast.success(`${selectedPackages.length} paquetes eliminados`);
      } else if (bulkAction === 'status') {
        await Promise.all(selectedPkgs.map(pkg => 
          base44.entities.Package.update(pkg.id, { status: bulkStatus })
        ));
        
        // Notify clients
        if (['en_transito', 'disponible', 'entregado'].includes(bulkStatus)) {
          const { notifyPackageStatus } = await import('@/components/NotificationUtils');
          selectedPkgs.forEach(pkg => notifyPackageStatus(pkg, bulkStatus));
        }
        
        toast.success(`${selectedPackages.length} paquetes actualizados`);
      }

      setSelectedPackages([]);
      setBulkAction('');
      setBulkStatus('');
      setShowBulkConfirm(false);
      loadPackages(page);
    } catch (error) {
      toast.error('Error al ejecutar acción masiva');
    }
    setBulkProcessing(false);
  };

  const handleExportPreAlerta = async () => {
    try {
      // Get only pre-alerta packages grouped by client
      const preAlertaPkgs = packages.filter(p => p.status === 'pre_alerta');
      
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
          content += `${pkg.tracking_number}\n${desc}\n`;
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
    try {
      const selectedPkgs = packages.filter(p => selectedPackages.includes(p.id));
      await Promise.all(selectedPkgs.map(p => base44.entities.Package.update(p.id, { reported: flag })));
      toast.success(flag ? 'Marcados como reportados' : 'Reporte removido');
      loadPackages(page);
    } catch (e) {
      toast.error('No se pudo actualizar');
    }
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

  const filteredPackages = packages.filter(pkg => {
    // Basic search
    const matchesSearch = 
      pkg.tracking_number.toLowerCase().includes(search.toLowerCase()) ||
      (pkg.shipping_mark || '').toLowerCase().includes(search.toLowerCase()) ||
      (pkg.client_email || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || pkg.status === statusFilter;
    const matchesReported = reportedFilter === 'all' || (reportedFilter === 'reported' ? pkg.reported === true : pkg.reported !== true);

    // Advanced filters
    if (advancedFilters) {
      const {
        tracking,
        email,
        shippingMark,
        status,
        shippingType,
        dateFrom,
        dateTo,
        hasInsurance
      } = advancedFilters;

      if (tracking && !pkg.tracking_number.toLowerCase().includes(tracking.toLowerCase())) return false;
      if (email && !pkg.client_email.toLowerCase().includes(email.toLowerCase())) return false;
      if (shippingMark && !(pkg.shipping_mark || '').toLowerCase().includes(shippingMark.toLowerCase())) return false;
      if (status !== 'all' && pkg.status !== status) return false;
      if (shippingType !== 'all' && pkg.shipping_type !== shippingType) return false;
      if (hasInsurance !== 'all' && pkg.has_insurance !== (hasInsurance === 'true')) return false;

      // Date filtering
      if (dateFrom || dateTo) {
        const pkgDate = new Date(pkg.created_date);
        if (dateFrom && pkgDate < new Date(dateFrom)) return false;
        if (dateTo && pkgDate > new Date(dateTo + 'T23:59:59')) return false;
      }
    }

    return matchesSearch && matchesStatus && matchesReported;
    });

    const simpleWindowSummary = (() => {
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
    })();

    if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
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
                <TabsList className="w-full overflow-x-auto whitespace-nowrap">
                  <TabsTrigger value="all">Todos</TabsTrigger>
                  <TabsTrigger value="pre_alerta">Pre-alerta</TabsTrigger>
                  <TabsTrigger value="recibido">Recibido</TabsTrigger>
                  <TabsTrigger value="consolidado">Consolidado</TabsTrigger>
                  <TabsTrigger value="en_transito">Tránsito</TabsTrigger>
                  <TabsTrigger value="entregado">Entregado</TabsTrigger>
                </TabsList>
              </Tabs>

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
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setCreateModalOpen(true)}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Package className="h-4 w-4 mr-2" />
                Registrar Paquete
              </Button>
              <Button
                onClick={handleExportPreAlerta}
                variant="outline"
                size="sm"
                className="border-blue-200 text-blue-600 hover:bg-blue-50"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar Pre-alerta
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      {selectedPackages.length > 0 && (
        <Card className="border-0 shadow-lg bg-blue-50">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={selectedPackages.length === filteredPackages.length}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm font-medium text-slate-700">
                  {selectedPackages.length} paquete(s) seleccionado(s)
                </span>
              </div>
              
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <Select value={bulkAction} onValueChange={setBulkAction}>
                  <SelectTrigger className="w-48 bg-white">
                    <SelectValue placeholder="Acción masiva" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="status">Cambiar Estado</SelectItem>
                    <SelectItem value="delete">Eliminar</SelectItem>
                  </SelectContent>
                </Select>

                {bulkAction === 'status' && (
                  <Select value={bulkStatus} onValueChange={setBulkStatus}>
                    <SelectTrigger className="w-40 bg-white">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recibido">Recibido</SelectItem>
                      <SelectItem value="en_transito">En Tránsito</SelectItem>
                      <SelectItem value="disponible">Disponible</SelectItem>
                      <SelectItem value="entregado">Entregado</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                <Button 
                  onClick={handleBulkAction}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Aplicar
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedPackages([])}
                >
                  Cancelar
                </Button>

                <Button 
                  variant="outline"
                  onClick={handleCopySelectedByMark}
                  className="gap-2"
                >
                  <Copy className="h-4 w-4" /> Copiar por Mark
                </Button>

                <Button 
                  variant="outline"
                  onClick={() => handleMarkReported(true)}
                >
                  Marcar reportados
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => handleMarkReported(false)}
                >
                  Quitar reporte
                </Button>

              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Barra de búsqueda superior */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Búsqueda rápida por tracking, shipping mark o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 w-full h-11"
        />
      </div>

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

      {/* Packages Table */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left p-4 font-medium text-slate-600">
                  <Checkbox 
                    checked={selectedPackages.length === filteredPackages.length && filteredPackages.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
                <th className="text-left p-4 font-medium text-slate-600">Tracking</th>
                <th className="text-left p-4 font-medium text-slate-600">Cliente</th>
                <th className="text-left p-4 font-medium text-slate-600">Shipping Mark</th>
                <th className="text-left p-4 font-medium text-slate-600">Tipo</th>
                <th className="text-left p-4 font-medium text-slate-600">Estado</th>
                <th className="text-left p-4 font-medium text-slate-600">Recepción</th>
                <th className="text-left p-4 font-medium text-slate-600">Registro</th>
                <th className="text-left p-4 font-medium text-slate-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPackages.map((pkg) => (
                <tr key={pkg.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <Checkbox 
                      checked={selectedPackages.includes(pkg.id)}
                      onCheckedChange={(checked) => handleSelectPackage(pkg.id, checked)}
                    />
                  </td>
                  <td className="p-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-slate-800">{pkg.tracking_number}</span>
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
                  <td className="p-4 text-slate-600">{pkg.client_email}</td>
                  <td className="p-4 font-mono text-slate-600">{pkg.shipping_mark || '-'}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-slate-600">
                      {pkg.shipping_type === 'aereo' 
                        ? <><Plane className="h-4 w-4" /> Aéreo</>
                        : <><Ship className="h-4 w-4" /> Marítimo</>
                      }
                    </div>
                  </td>
                  <td className="p-4">
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
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleCreateTicket(pkg)}
                        className="gap-1"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Ticket
                      </Button>
                      {pkg.status === 'pre_alerta' && (
                        <Button 
                          size="sm" 
                          onClick={() => setReceiveModal(pkg)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Recibir
                        </Button>
                      )}
                      {pkg.package_image_url && (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setViewImage(pkg.package_image_url)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {pkg.status === 'recibido' && (
                             <Button 
                               size="sm" 
                               variant="outline"
                               onClick={() => setEditImageModal(pkg)}
                               className="text-blue-600 hover:text-blue-700"
                             >
                               <ImageIcon className="h-4 w-4" />
                             </Button>
                           )}
                          </>
                          )}
                          {!pkg.package_image_url && pkg.status === 'recibido' && (
                          <Button 
                           size="sm" 
                           variant="outline"
                           onClick={() => setEditImageModal(pkg)}
                           className="text-blue-600 hover:text-blue-700"
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
                                                  className="gap-1 h-8 px-3 text-xs text-rose-600 hover:text-rose-700 border-rose-200"
                                                >
                           <Undo2 className="h-4 w-4 mr-1" />
                           Cancelar recepción
                          </Button>
                          )}
                          {pkg.status !== 'pre_alerta' && pkg.status !== 'consolidado' && (
                          <Select 
                           value={pkg.status} 
                           onValueChange={(val) => handleStatusChange(pkg, val)}
                          >
                           <SelectTrigger className="w-32">
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="recibido">Recibido</SelectItem>
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

        <Pagination page={page} onPrev={() => setPage(p => Math.max(p - 1, 0))} onNext={() => setPage(p => (hasNext ? p + 1 : p))} hasNext={hasNext} />

        {/* Receive Modal */}
      <Dialog open={!!receiveModal} onOpenChange={() => setReceiveModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Recepción</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-500">Tracking</p>
              <p className="font-mono font-medium">{receiveModal?.tracking_number}</p>
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Foto del paquete (opcional)
              </Label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="pkg-image"
                />
                <label htmlFor="pkg-image" className="cursor-pointer">
                  {imageFile ? (
                    <div className="flex items-center justify-center gap-2 text-emerald-600">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">{imageFile.name}</span>
                    </div>
                  ) : (
                    <div className="text-slate-500">
                      <ImageIcon className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                      <p className="text-sm">Click para subir foto</p>
                    </div>
                  )}
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveModal(null)}>
              Cancelar
            </Button>
            <Button onClick={handleReceive} disabled={processing} className="bg-blue-600 hover:bg-blue-700">
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Confirmar Recepción
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Image Modal */}
      <Dialog open={!!viewImage} onOpenChange={() => setViewImage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Foto del Paquete</DialogTitle>
          </DialogHeader>
          <img src={viewImage} alt="Paquete" className="w-full rounded-lg" />
        </DialogContent>
      </Dialog>

      {/* Edit Image Modal */}
      <Dialog open={!!editImageModal} onOpenChange={() => {
        setEditImageModal(null);
        setNewImageFile(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editImageModal?.package_image_url ? 'Reemplazar Foto' : 'Agregar Foto'}
            </DialogTitle>
            <DialogDescription>
              Tracking: {editImageModal?.tracking_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editImageModal?.package_image_url && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Foto actual</p>
                <img src={editImageModal.package_image_url} alt="Actual" className="w-full rounded-lg" />
              </div>
            )}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                {editImageModal?.package_image_url ? 'Nueva' : 'Foto del'} paquete
              </Label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNewImageFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="edit-pkg-image"
                />
                <label htmlFor="edit-pkg-image" className="cursor-pointer">
                  {newImageFile ? (
                    <div className="flex items-center justify-center gap-2 text-emerald-600">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium text-sm">{newImageFile.name}</span>
                    </div>
                  ) : (
                    <div className="text-slate-500">
                      <ImageIcon className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                      <p className="text-sm">Click para subir foto</p>
                    </div>
                  )}
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditImageModal(null);
              setNewImageFile(null);
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleUpdateImage} 
              disabled={processing || !newImageFile} 
              className="bg-blue-600 hover:bg-blue-700"
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              {editImageModal?.package_image_url ? 'Reemplazar' : 'Agregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Ticket Modal */}
      <Dialog open={!!ticketModal} onOpenChange={() => { setTicketModal(null); setTicketMessage(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Ticket</DialogTitle>
            <DialogDescription>
              Cliente: {ticketModal?.client_email} • Tracking: {ticketModal?.tracking_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Mensaje (opcional)</Label>
            <Textarea rows={4} placeholder="Escribe un mensaje para el cliente..." value={ticketMessage} onChange={(e) => setTicketMessage(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTicketModal(null); setTicketMessage(''); }} disabled={ticketProcessing}>
              Cancelar
            </Button>
            <Button onClick={confirmCreateTicket} disabled={ticketProcessing} className="bg-blue-600 hover:bg-blue-700">
              {ticketProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageSquare className="h-4 w-4 mr-2" />}
              Crear Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

       {/* Bulk Action Confirmation */}
      <AlertDialog open={showBulkConfirm} onOpenChange={setShowBulkConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Acción Masiva</AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === 'delete' ? (
                <>
                  Estás a punto de <span className="font-semibold text-red-600">eliminar {selectedPackages.length} paquete(s)</span>.
                  Esta acción no se puede deshacer.
                </>
              ) : bulkAction === 'status' ? (
                <>
                  Cambiarás el estado de <span className="font-semibold">{selectedPackages.length} paquete(s)</span> a{' '}
                  <span className="font-semibold text-blue-600">{bulkStatus}</span>.
                  {['en_transito', 'disponible', 'entregado'].includes(bulkStatus) && ' Los clientes serán notificados.'}
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                executeBulkAction();
              }}
              disabled={bulkProcessing}
              className={bulkAction === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}
            >
              {bulkProcessing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando...</>
              ) : (
                <>Confirmar</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Reception Modal */}
      <AlertDialog open={!!cancelReceptionModal} onOpenChange={setCancelReceptionModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar recepción</AlertDialogTitle>
            <AlertDialogDescription>
              Esto revertirá el paquete a estado <span class="font-semibold">Pre‑alerta</span> y limpiará fecha, usuario y foto de recepción.
              <br />
              Tracking: <span class="font-mono">{cancelReceptionModal?.tracking_number}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelProcessing}>Cerrar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              disabled={cancelProcessing}
              onClick={async (e) => {
                e.preventDefault();
                try {
                  setCancelProcessing(true);
                  await base44.entities.Package.update(cancelReceptionModal.id, {
                    status: 'pre_alerta',
                    received_date: null,
                    received_by: null,
                    package_image_url: null
                  });
                  toast.success('Recepción cancelada');
                  setCancelReceptionModal(null);
                  loadPackages(page);
                } catch (_) {
                  toast.error('No se pudo cancelar la recepción');
                }
                setCancelProcessing(false);
              }}
            >
              {cancelProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Procesando...</> : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Register Package Modal */}
      <RegisterPackageModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onCreated={() => {
          setCreateModalOpen(false);
          loadPackages(page);
        }}
      />
    </div>
  );
}