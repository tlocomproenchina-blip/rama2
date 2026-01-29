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
  Shield
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import { Badge } from "@/components/ui/badge";

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

      // Notify client (async, don't wait)
      base44.integrations.Core.SendEmail({
        to: receiveModal.client_email,
        subject: '📦 Tu paquete ha sido recibido',
        body: `¡Buenas noticias! Tu paquete con tracking ${receiveModal.tracking_number} ha sido recibido en nuestro almacén.\n\nPronto será procesado para consolidación.`
      }).catch(err => console.error('Email error:', err));

      base44.entities.Notification.create({
        user_email: receiveModal.client_email,
        title: '📦 Paquete Recibido',
        message: `Tu paquete ${receiveModal.tracking_number} ha sido recibido en el warehouse.`,
        type: 'package',
        icon: 'check',
        reference_id: receiveModal.id
      }).catch(err => console.error('Notification error:', err));

      toast.success('Paquete marcado como recibido');
      setReceiveModal(null);
      setImageFile(null);
      loadPackages();
    } catch (error) {
      toast.error('Error al procesar');
    }
    setProcessing(false);
  };

  const handleStatusChange = async (pkg, newStatus) => {
    await base44.entities.Package.update(pkg.id, { status: newStatus });
    
    // Notify client
    if (['en_transito', 'disponible', 'entregado'].includes(newStatus)) {
      const { notifyPackageStatus } = await import('@/utils/notifications');
      notifyPackageStatus(pkg, newStatus);
    }
    
    toast.success('Estado actualizado y cliente notificado');
    loadPackages();
  };

  const filteredPackages = packages.filter(pkg => {
    const matchesSearch = 
      pkg.tracking_number.toLowerCase().includes(search.toLowerCase()) ||
      (pkg.shipping_mark || '').toLowerCase().includes(search.toLowerCase()) ||
      (pkg.client_email || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || pkg.status === statusFilter;
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

      {/* Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por tracking, shipping mark o email..."
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

      {/* Packages Table */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
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
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setViewImage(pkg.package_image_url)}
                        >
                          <Eye className="h-4 w-4" />
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
    </div>
  );
}