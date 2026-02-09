import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Download
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import AdvancedSearch from '@/components/admin/AdvancedSearch';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

export default function AdminPackages({ user }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    const pkgs = await base44.entities.Package.list('-created_date');
    setPackages(pkgs);
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
      loadPackages();
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
      loadPackages();
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
    loadPackages();
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
      loadPackages();
    } catch (error) {
      toast.error('Error al ejecutar acción masiva');
    }
    setBulkProcessing(false);
  };

  const filteredPackages = packages.filter(pkg => {
    // Basic search
    const matchesSearch = 
      pkg.tracking_number.toLowerCase().includes(search.toLowerCase()) ||
      (pkg.shipping_mark || '').toLowerCase().includes(search.toLowerCase()) ||
      (pkg.client_email || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || pkg.status === statusFilter;

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

    return matchesSearch && matchesStatus;
  });

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
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Búsqueda rápida por tracking, shipping mark o email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full lg:w-auto">
              <TabsList className="grid grid-cols-3 lg:grid-cols-6 w-full">
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="pre_alerta">Pre-alerta</TabsTrigger>
                <TabsTrigger value="recibido">Recibido</TabsTrigger>
                <TabsTrigger value="consolidado">Consolidado</TabsTrigger>
                <TabsTrigger value="en_transito">Tránsito</TabsTrigger>
                <TabsTrigger value="entregado">Entregado</TabsTrigger>
              </TabsList>
            </Tabs>
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
              </div>
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
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-slate-800">{pkg.tracking_number}</span>
                      {pkg.has_insurance && (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          <Shield className="h-3 w-3" />
                        </Badge>
                      )}
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
                  <td className="p-4">
                    <div className="flex items-center gap-2">
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
    </div>
  );
}