import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Search, 
  Edit2,
  Save,
  X,
  Loader2,
  Package,
  MapPin,
  Phone,
  Mail,
  Tag,
  CheckCircle,
  Clock,
  Eye,
  Trash2,
  AlertTriangle,
  Copy,
  Plus,
  Upload,
  Plane,
  Ship
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from 'sonner';
import ClientDetailsModal from '@/components/admin/ClientDetailsModal';

export default function AdminClients({ user }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editClient, setEditClient] = useState(null);
  const [viewClient, setViewClient] = useState(null);
  const [deleteClient, setDeleteClient] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [packagesCount, setPackagesCount] = useState({});
  const [addingPackage, setAddingPackage] = useState(false);
  const [packageClient, setPackageClient] = useState(null);
  const [newPackage, setNewPackage] = useState({
    tracking_number: '',
    description: '',
    shipping_type: 'aereo',
    has_insurance: false,
    fob_value: '',
    package_image_url: ''
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    const [users, packages] = await Promise.all([
      base44.entities.User.filter({ role: 'user' }),
      base44.entities.Package.list()
    ]);

    // Count packages per client
    const counts = {};
    packages.forEach(pkg => {
      counts[pkg.client_email] = (counts[pkg.client_email] || 0) + 1;
    });
    setPackagesCount(counts);

    setClients(users);
    setLoading(false);
  };

  const handleEdit = (client) => {
    setEditClient(client);
    setEditData({
      first_name: client.first_name || '',
      last_name: client.last_name || '',
      city: client.city || '',
      whatsapp: client.whatsapp || '',
      shipping_mark: client.shipping_mark || ''
    });
  };

  const handleSave = async () => {
    if (!editClient) return;
    setSaving(true);

    try {
      // Validate shipping mark format
      if (editData.shipping_mark && !editData.shipping_mark.startsWith('TLEC-')) {
        editData.shipping_mark = `TLEC-${editData.shipping_mark.replace('TLEC-', '')}`;
      }

      // Validate shipping mark suffix (max 10 chars, alphanumeric)
      const suffix = editData.shipping_mark.replace('TLEC-', '');
      if (suffix && (suffix.length > 10 || !/^[A-Za-z0-9]*$/.test(suffix))) {
        toast.error('El Shipping Mark debe tener máximo 10 caracteres alfanuméricos');
        setSaving(false);
        return;
      }

      await base44.entities.User.update(editClient.id, editData);

      // If shipping mark was assigned, update existing packages and notify client
      if (editData.shipping_mark && !editClient.shipping_mark) {
        const clientPackages = await base44.entities.Package.filter({ client_email: editClient.email });
        for (const pkg of clientPackages) {
          await base44.entities.Package.update(pkg.id, { shipping_mark: editData.shipping_mark });
        }

        // Send email notification to client
        base44.integrations.Core.SendEmail({
          to: editClient.email,
          subject: '🎉 Shipping Mark Asignado',
          body: `¡Hola ${editData.first_name || 'Usuario'}!\n\nTu Shipping Mark ha sido asignado:\n\n${editData.shipping_mark}\n\nYa puedes comenzar a enviar tus paquetes. Usa este código en todas tus compras online.\n\nDirección del warehouse: Disponible en tu panel de control.`
        }).catch(err => console.error('Email error:', err));

        // In-app notification
        base44.entities.Notification.create({
          user_email: editClient.email,
          title: '🎉 Shipping Mark Asignado',
          message: `Tu Shipping Mark es: ${editData.shipping_mark}. Ya puedes realizar envíos.`,
          type: 'general',
          icon: 'check'
        }).catch(err => console.error('Notification error:', err));
      }

      toast.success('Cliente actualizado y notificado');
      setEditClient(null);
      loadClients();
    } catch (error) {
      toast.error('Error al guardar');
    }
    setSaving(false);
  };

  const handleCopyClientInfo = (client) => {
    const info = `Nombre: ${client.first_name || ''} ${client.last_name || ''}
Ciudad: ${client.city || 'N/A'}
WhatsApp: ${client.whatsapp || 'N/A'}
Email: ${client.email}`;
    
    navigator.clipboard.writeText(info);
    toast.success('Información copiada al portapapeles');
  };

  const handleDelete = async () => {
    if (!deleteClient) return;
    setDeleting(true);

    try {
      // Check if client has packages
      const clientPackages = await base44.entities.Package.filter({ client_email: deleteClient.email });
      const clientConsolidations = await base44.entities.Consolidation.filter({ client_email: deleteClient.email });

      if (clientPackages.length > 0 || clientConsolidations.length > 0) {
        toast.error('No se puede eliminar: el cliente tiene paquetes o consolidaciones asociadas');
        setDeleting(false);
        setDeleteClient(null);
        return;
      }

      // Delete user
      await base44.entities.User.delete(deleteClient.id);

      toast.success('Cliente eliminado exitosamente');
      setDeleteClient(null);
      loadClients();
    } catch (error) {
      toast.error('Error al eliminar el cliente');
    }
    setDeleting(false);
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setNewPackage({ ...newPackage, package_image_url: file_url });
      toast.success('Imagen subida');
    } catch (error) {
      toast.error('Error al subir imagen');
    }
    setUploadingImage(false);
  };

  const handleAddPackage = async () => {
    if (!newPackage.tracking_number || !newPackage.description) {
      toast.error('Completa tracking y descripción');
      return;
    }

    setSaving(true);
    try {
      await base44.entities.Package.create({
        tracking_number: newPackage.tracking_number,
        client_email: packageClient.email,
        shipping_mark: packageClient.shipping_mark || '',
        shipping_type: newPackage.shipping_type,
        description: newPackage.description,
        status: 'recibido',
        has_insurance: newPackage.has_insurance,
        fob_value: newPackage.has_insurance ? parseFloat(newPackage.fob_value) || 0 : 0,
        package_image_url: newPackage.package_image_url || '',
        received_date: new Date().toISOString(),
        received_by: user?.email
      });

      // Notify client
      base44.integrations.Core.SendEmail({
        to: packageClient.email,
        subject: '📦 Paquete recibido en warehouse',
        body: `Tu paquete ${newPackage.tracking_number} ha sido recibido en nuestro warehouse.\n\nDescripción: ${newPackage.description}\nTipo: ${newPackage.shipping_type === 'aereo' ? 'Aéreo' : 'Marítimo'}\n\nIngresa al sistema para más detalles.`
      }).catch(err => console.error('Email error:', err));

      base44.entities.Notification.create({
        user_email: packageClient.email,
        title: '📦 Paquete Recibido',
        message: `Tu paquete ${newPackage.tracking_number} llegó al warehouse`,
        type: 'package',
        icon: 'package',
        reference_id: newPackage.tracking_number
      }).catch(err => console.error('Notification error:', err));

      toast.success('Paquete agregado exitosamente');
      setAddingPackage(false);
      setPackageClient(null);
      setNewPackage({
        tracking_number: '',
        description: '',
        shipping_type: 'aereo',
        has_insurance: false,
        fob_value: '',
        package_image_url: ''
      });
      loadClients();
    } catch (error) {
      toast.error('Error al agregar paquete');
    }
    setSaving(false);
  };

  const filteredClients = clients.filter(client => {
    const searchLower = search.toLowerCase();
    return (
      (client.email || '').toLowerCase().includes(searchLower) ||
      (client.first_name || '').toLowerCase().includes(searchLower) ||
      (client.last_name || '').toLowerCase().includes(searchLower) ||
      (client.city || '').toLowerCase().includes(searchLower) ||
      (client.whatsapp || '').toLowerCase().includes(searchLower) ||
      (client.shipping_mark || '').toLowerCase().includes(searchLower)
    );
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
        <h1 className="text-2xl font-bold text-slate-800">Gestión de Clientes</h1>
        <p className="text-slate-500">Administra los usuarios y asigna Shipping Marks</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Clientes</p>
                <p className="text-3xl font-bold text-slate-800">{clients.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Con Shipping Mark</p>
                <p className="text-3xl font-bold text-slate-800">
                  {clients.filter(c => c.shipping_mark).length}
                </p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-xl">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pendientes</p>
                <p className="text-3xl font-bold text-slate-800">
                  {clients.filter(c => !c.shipping_mark && c.profile_completed).length}
                </p>
              </div>
              <div className="p-3 bg-amber-100 rounded-xl">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Paquetes</p>
                <p className="text-3xl font-bold text-slate-800">
                  {Object.values(packagesCount).reduce((a, b) => a + b, 0)}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl">
                <Package className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por nombre, email, ciudad, WhatsApp o Shipping Mark..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Clients List */}
      {filteredClients.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <Users className="h-16 w-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Sin clientes</h3>
            <p className="text-slate-500">No se encontraron clientes</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredClients.map((client) => (
            <Card 
              key={client.id} 
              className={`border-0 shadow-md hover:shadow-lg transition-shadow ${
                !client.shipping_mark && client.profile_completed ? 'border-l-4 border-l-amber-400' : ''
              }`}
            >
              <CardContent className="p-4 lg:p-6">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Avatar & Name */}
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                      {(client.first_name?.[0] || client.email[0]).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">
                        {client.first_name && client.last_name 
                          ? `${client.first_name} ${client.last_name}`
                          : client.email
                        }
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                        <Mail className="h-3 w-3" />
                        {client.email}
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    {client.city && (
                      <Badge variant="outline" className="bg-slate-50">
                        <MapPin className="h-3 w-3 mr-1" />
                        {client.city}
                      </Badge>
                    )}
                    {client.whatsapp && (
                      <Badge variant="outline" className="bg-slate-50">
                        <Phone className="h-3 w-3 mr-1" />
                        {client.whatsapp}
                      </Badge>
                    )}
                    {client.shipping_mark ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                        <Tag className="h-3 w-3 mr-1" />
                        {client.shipping_mark}
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                        <Clock className="h-3 w-3 mr-1" />
                        Sin Shipping Mark
                      </Badge>
                    )}
                    <Badge variant="outline">
                      <Package className="h-3 w-3 mr-1" />
                      {packagesCount[client.email] || 0} paquetes
                    </Badge>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyClientInfo(client);
                      }}
                      title="Copiar información"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setPackageClient(client);
                        setAddingPackage(true);
                      }}
                      className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Paquete
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setViewClient(client)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEdit(client)}
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setDeleteClient(client)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Client Details Modal */}
      <ClientDetailsModal
        client={viewClient}
        open={!!viewClient}
        onClose={() => setViewClient(null)}
        onClientUpdated={loadClients}
      />

      {/* Add Package Dialog */}
      <Dialog open={addingPackage} onOpenChange={setAddingPackage}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Agregar Paquete Recibido</DialogTitle>
            <DialogDescription>
              Crear paquete directamente como recibido para {packageClient?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Número de Tracking *</Label>
              <Input
                value={newPackage.tracking_number}
                onChange={(e) => setNewPackage({ ...newPackage, tracking_number: e.target.value })}
                placeholder="Ej: 1234567890"
              />
            </div>

            <div className="space-y-2">
              <Label>Descripción *</Label>
              <Textarea
                value={newPackage.description}
                onChange={(e) => setNewPackage({ ...newPackage, description: e.target.value })}
                placeholder="Describe el contenido del paquete"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Envío</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setNewPackage({ ...newPackage, shipping_type: 'aereo' })}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    newPackage.shipping_type === 'aereo'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Plane className={`h-5 w-5 mx-auto mb-1 ${
                    newPackage.shipping_type === 'aereo' ? 'text-blue-600' : 'text-slate-400'
                  }`} />
                  <span className="text-sm font-medium">Aéreo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewPackage({ ...newPackage, shipping_type: 'maritimo' })}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    newPackage.shipping_type === 'maritimo'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Ship className={`h-5 w-5 mx-auto mb-1 ${
                    newPackage.shipping_type === 'maritimo' ? 'text-blue-600' : 'text-slate-400'
                  }`} />
                  <span className="text-sm font-medium">Marítimo</span>
                </button>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <Checkbox
                id="package-insurance"
                checked={newPackage.has_insurance}
                onCheckedChange={(checked) => setNewPackage({ ...newPackage, has_insurance: checked })}
              />
              <div className="flex-1">
                <label htmlFor="package-insurance" className="font-medium text-slate-800 cursor-pointer">
                  Asegurar Carga
                </label>
                {newPackage.has_insurance && (
                  <div className="mt-2 space-y-2">
                    <Label>Valor FOB (USD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newPackage.fob_value}
                      onChange={(e) => setNewPackage({ ...newPackage, fob_value: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Imagen del Paquete (Opcional)</Label>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e.target.files[0])}
                  disabled={uploadingImage}
                />
                {uploadingImage && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
              </div>
              {newPackage.package_image_url && (
                <img src={newPackage.package_image_url} alt="Preview" className="h-32 rounded-lg border" />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddingPackage(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddPackage} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Agregar Paquete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteClient} onOpenChange={() => setDeleteClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              ¿Eliminar Cliente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar a{' '}
              <span className="font-semibold text-slate-800">
                {deleteClient?.first_name && deleteClient?.last_name
                  ? `${deleteClient.first_name} ${deleteClient.last_name}`
                  : deleteClient?.email}
              </span>
              . Esta acción no se puede deshacer.
              {packagesCount[deleteClient?.email] > 0 && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm font-medium">
                    ⚠️ Este cliente tiene {packagesCount[deleteClient?.email]} paquetes asociados.
                    No se puede eliminar hasta que se eliminen todos sus paquetes.
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting || packagesCount[deleteClient?.email] > 0}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Eliminando...</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-2" /> Eliminar</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Modal */}
      <Dialog open={!!editClient} onOpenChange={() => setEditClient(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
            <DialogDescription>
              Actualiza la información del cliente y asigna o modifica su Shipping Mark
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={editData.first_name}
                  onChange={(e) => setEditData({ ...editData, first_name: e.target.value })}
                  placeholder="Nombre"
                />
              </div>
              <div className="space-y-2">
                <Label>Apellido</Label>
                <Input
                  value={editData.last_name}
                  onChange={(e) => setEditData({ ...editData, last_name: e.target.value })}
                  placeholder="Apellido"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Ciudad
              </Label>
              <Input
                value={editData.city}
                onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                placeholder="Ciudad de entrega"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Phone className="h-4 w-4" /> WhatsApp
              </Label>
              <Input
                value={editData.whatsapp}
                onChange={(e) => setEditData({ ...editData, whatsapp: e.target.value })}
                placeholder="+58 412 1234567"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Tag className="h-4 w-4" /> Shipping Mark
              </Label>
              <div className="flex gap-2">
                <div className="flex items-center px-3 bg-slate-100 rounded-l-lg border border-r-0 border-slate-200 text-slate-600 font-medium">
                  TLEC-
                </div>
                <Input
                  value={editData.shipping_mark?.replace('TLEC-', '') || ''}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                    setEditData({ ...editData, shipping_mark: `TLEC-${value}` });
                  }}
                  placeholder="XXXXXXXXXX"
                  maxLength={10}
                  className="rounded-l-none font-mono"
                />
              </div>
              <p className="text-xs text-slate-500">Máximo 10 caracteres alfanuméricos</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditClient(null)}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}