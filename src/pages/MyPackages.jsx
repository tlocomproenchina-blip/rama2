import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Package, 
  Search, 
  Plus, 
  Plane, 
  Ship,
  Shield,
  Image as ImageIcon,
  Loader2,
  ExternalLink,
  Pencil,
  Trash2
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ListSkeletonLoader } from '@/components/SkeletonLoaders';

export default function MyPackages({ user }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedImage, setSelectedImage] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState({ tracking_number: '', description: '', shipping_type: 'aereo' });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadPackages();
    
    // Real-time updates
    if (user) {
      let debounceTimer;
      const unsubscribe = base44.entities.Package.subscribe((event) => {
        if (event.data?.client_email === user.email) {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => loadPackages(), 1000);
        }
      });
      
      return () => {
        clearTimeout(debounceTimer);
        unsubscribe();
      };
    }
  }, [user]);

  const loadPackages = async () => {
    if (!user) return;
    const pkgs = await base44.entities.Package.filter({ client_email: user.email }, '-created_date');
    setPackages(pkgs);
    setLoading(false);
  };



  // Edit/Delete handlers
  const openEdit = (pkg) => {
    setEditModal(pkg);
    setEditForm({
      tracking_number: pkg.tracking_number || '',
      description: pkg.description || '',
      shipping_type: pkg.shipping_type || 'aereo'
    });
  };

  const saveEdit = async () => {
    if (!editModal) return;
    const tn = (editForm.tracking_number || '').trim();
    if (!tn) { toast.error('Ingresa el tracking'); return; }
    setSaving(true);
    await base44.entities.Package.update(editModal.id, {
      tracking_number: tn,
      description: editForm.description || '',
      shipping_type: editForm.shipping_type || 'aereo'
    });
    setSaving(false);
    setEditModal(null);
    toast.success('Paquete actualizado');
    loadPackages();
  };

  const openDelete = (pkg) => setDeleteConfirm(pkg);

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    await base44.entities.Package.delete(deleteConfirm.id);
    setDeleting(false);
    setDeleteConfirm(null);
    toast.success('Paquete eliminado');
    loadPackages();
  };

  const filteredPackages = useMemo(() => {
    return packages.filter(pkg => {
      const matchesSearch = pkg.tracking_number.toLowerCase().includes(search.toLowerCase()) ||
                           (pkg.description || '').toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || pkg.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [packages, search, statusFilter]);

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-5 lg:space-y-6 w-full">
        <div className="h-8 bg-slate-200 rounded w-32 animate-pulse" />
        <ListSkeletonLoader count={5} />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-5 lg:space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Mis Paquetes</h1>
          <p className="text-xs md:text-sm text-slate-500">Gestiona y rastrea todos tus paquetes</p>
        </div>
        {user?.shipping_mark && (
          <Link to={createPageUrl('PreAlert')}>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Pre-alerta
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-3 md:p-4">
          <div className="flex flex-col gap-3 md:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por tracking..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>
            <div className="overflow-x-auto -mx-3 md:mx-0">
              <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-max md:w-full">
              <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full">
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="pre_alerta">Pre-alerta</TabsTrigger>
                <TabsTrigger value="recibido">Recibido</TabsTrigger>
                <TabsTrigger value="consolidado">Consolidado</TabsTrigger>
                <TabsTrigger value="en_transito">En Tránsito</TabsTrigger>
                <TabsTrigger value="entregado">Entregado</TabsTrigger>
              </TabsList>
            </Tabs>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Packages List */}
      {filteredPackages.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6 md:p-12 text-center">
            <Package className="h-12 md:h-16 w-12 md:w-16 mx-auto mb-3 md:mb-4 text-slate-300" />
            <h3 className="text-base md:text-lg font-semibold text-slate-700 mb-2">No hay paquetes</h3>
            <p className="text-xs md:text-sm text-slate-500 mb-3 md:mb-4">
              {search ? 'No se encontraron paquetes con ese criterio' : 'Aún no tienes paquetes registrados'}
            </p>
            {user?.shipping_mark && !search && (
              <Link to={createPageUrl('PreAlert')}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Pre-alerta
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:gap-4">
          {filteredPackages.map((pkg) => (
            <Card key={pkg.id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
              <CardContent className="p-3 md:p-4 lg:p-6">
                <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                  {/* Main Info */}
                   <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 md:gap-3 mb-2">
                      <div className="p-2 bg-slate-100 rounded-lg flex-shrink-0">
                        {pkg.shipping_type === 'aereo' 
                          ? <Plane className="h-4 w-4 md:h-5 text-blue-600" />
                          : <Ship className="h-4 w-4 md:h-5 text-blue-600" />
                        }
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-800 font-mono text-xs md:text-sm truncate">{pkg.tracking_number}</h3>
                        <p className="text-xs md:text-sm text-slate-500 capitalize">
                          {pkg.shipping_type === 'aereo' ? 'Aéreo' : 'Marítimo'}
                        </p>
                      </div>
                    </div>
                    {pkg.description && (
                      <p className="text-xs md:text-sm text-slate-600 mt-2 line-clamp-2">{pkg.description}</p>
                    )}
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    {pkg.has_insurance && (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                        <Shield className="h-3 w-3 mr-1" />
                        Asegurado
                      </Badge>
                    )}
                    {pkg.package_image_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedImage(pkg.package_image_url)}
                        className="text-slate-600 text-xs"
                      >
                        <ImageIcon className="h-3 w-3 mr-1" />
                        Ver Foto
                      </Button>
                    )}
                    <StatusBadge status={pkg.status} />
                    {pkg.status === 'pre_alerta' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(pkg)}
                          className="text-slate-600 text-xs"
                        >
                          <Pencil className="h-3 w-3 mr-1" /> Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDelete(pkg)}
                          className="text-red-600 border-red-200 text-xs"
                        >
                          <Trash2 className="h-3 w-3 mr-1" /> Eliminar
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Date */}
                  <div className="text-xs md:text-sm text-slate-500">
                    {new Date(pkg.created_date).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Image Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-xl md:max-w-2xl mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg">Foto del Paquete</DialogTitle>
          </DialogHeader>
          <div className="mt-4 overflow-y-auto max-h-[70vh]">
            <img 
              src={selectedImage} 
              alt="Paquete recibido" 
              className="w-full rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Package Modal */}
      <Dialog open={!!editModal} onOpenChange={() => setEditModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg">Editar Paquete</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tracking</Label>
              <Input
                value={editForm.tracking_number}
                onChange={(e) => setEditForm({ ...editForm, tracking_number: e.target.value })}
                placeholder="Número de tracking"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Detalles opcionales"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Tipo de envío</Label>
              <Select
                value={editForm.shipping_type}
                onValueChange={(v) => setEditForm({ ...editForm, shipping_type: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecciona tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aereo">Aéreo</SelectItem>
                  <SelectItem value="maritimo">Marítimo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal(null)}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar paquete</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el registro de tu pre-alerta. ¿Deseas continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}