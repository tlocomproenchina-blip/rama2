import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
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
import OptimizedImage from '@/components/OptimizedImage';
import ClientPageHero from '@/components/client-portal/ClientPageHero';
import ClientSectionHeader from '@/components/client-portal/ClientSectionHeader';
import PortalMetricCard from '@/components/client-portal/PortalMetricCard';
import useEntitySubscription from '@/hooks/useEntitySubscription';

export default function MyPackages({ user }) {
  const PAGE_SIZE = 200;
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedGallery, setSelectedGallery] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState({ tracking_number: '', description: '', shipping_type: 'aereo', seller_delivery_date: '' });
  const [sellerDateModal, setSellerDateModal] = useState(null);
  const [sellerDateValue, setSellerDateValue] = useState('');
  const [savingSellerDate, setSavingSellerDate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    loadPackages(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  useEntitySubscription(
    'Package',
    () => loadPackages(),
    {
      enabled: !!user?.email,
      filter: (event) => event?.data?.client_email === user?.email,
      debounceMs: 1000,
    },
    [user?.email]
  );

  const loadPackages = async (append = false) => {
    if (!user) return;
    if (append) setLoadingMore(true); else setLoading(true);
    const skip = append ? packages.length : 0;
    const pkgs = await base44.entities.Package.filter({ client_email: user.email }, '-created_date', PAGE_SIZE, skip);
    if (append) {
      setPackages((prev) => [...prev, ...pkgs]);
    } else {
      setPackages(pkgs);
    }
    setHasMore(pkgs.length === PAGE_SIZE);
    if (append) setLoadingMore(false); else setLoading(false);
  };



  // Edit/Delete handlers
  const openEdit = (pkg) => {
    setEditModal(pkg);
    setEditForm({
      tracking_number: pkg.tracking_number || '',
      description: pkg.description || '',
      shipping_type: pkg.shipping_type || 'aereo',
      seller_delivery_date: pkg.seller_delivery_date || ''
    });
  };

  const openSellerDate = (pkg) => {
    setSellerDateModal(pkg);
    setSellerDateValue(pkg.seller_delivery_date || '');
  };

  const saveSellerDate = async () => {
    if (!sellerDateModal) return;
    setSavingSellerDate(true);
    const updates = { seller_delivery_date: sellerDateValue || null };
    await base44.entities.Package.update(sellerDateModal.id, updates);
    setPackages((prev) => prev.map((p) => p.id === sellerDateModal.id ? { ...p, ...updates } : p));
    setSavingSellerDate(false);
    setSellerDateModal(null);
    toast.success('Fecha de entrega del vendedor guardada');
  };

  const saveEdit = async () => {
    if (!editModal) return;
    const tn = (editForm.tracking_number || '').trim();
    if (!tn) { toast.error('Ingresa el tracking'); return; }
    setSaving(true);
    const updates = {
      tracking_number: tn,
      description: editForm.description || '',
      shipping_type: editForm.shipping_type || 'aereo',
      seller_delivery_date: editForm.seller_delivery_date || null
    };
    await base44.entities.Package.update(editModal.id, updates);
    // Optimistic update: actualiza solo el item editado en lugar de recargar toda la lista
    setPackages((prev) => prev.map((p) => p.id === editModal.id ? { ...p, ...updates } : p));
    setSaving(false);
    setEditModal(null);
    toast.success('Paquete actualizado');
  };

  const openDelete = (pkg) => setDeleteConfirm(pkg);

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    await base44.entities.Package.delete(deleteConfirm.id);
    // Optimistic update: quita el item localmente sin recargar todo
    setPackages((prev) => prev.filter((p) => p.id !== deleteConfirm.id));
    setDeleting(false);
    setDeleteConfirm(null);
    toast.success('Paquete eliminado');
  };

  const filteredPackages = useMemo(() => {
    return packages.filter(pkg => {
      const matchesSearch = pkg.tracking_number.toLowerCase().includes(search.toLowerCase()) ||
                           (pkg.description || '').toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || pkg.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [packages, search, statusFilter]);

  const packageStats = React.useMemo(() => ({
    total: packages.length,
    preAlerta: packages.filter((pkg) => pkg.status === 'pre_alerta').length,
    recibidos: packages.filter((pkg) => pkg.status === 'recibido').length,
    entregados: packages.filter((pkg) => pkg.status === 'entregado').length,
  }), [packages]);

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
      <ClientPageHero
        icon={Package}
        eyebrow="Gestión de envíos"
        title="Mis Paquetes"
        description="Gestiona, filtra y revisa cada paquete en una vista más clara y premium."
        badges={[`${packages.length} registros`, user?.shipping_mark ? 'Shipping Mark activo' : 'Asignación pendiente']}
        action={user?.shipping_mark ? (
          <Link to={createPageUrl('PreAlert')}>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Pre-alerta
            </Button>
          </Link>
        ) : null}
        aside={
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Búsqueda rápida</p>
            <p className="text-sm text-slate-700">Usa filtros por tracking o estado para ubicar tus paquetes más rápido.</p>
            <div className="rounded-2xl bg-slate-100/90 px-3 py-2 text-sm font-medium text-slate-700">
              Mostrando {filteredPackages.length} resultado(s)
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PortalMetricCard title="Total" value={packageStats.total} subtitle="Paquetes registrados" icon={Package} tone="blue" />
        <PortalMetricCard title="Pre-alertas" value={packageStats.preAlerta} subtitle="Pendientes de recepción" icon={Plus} tone="amber" />
        <PortalMetricCard title="Recibidos" value={packageStats.recibidos} subtitle="Disponibles para gestión" icon={Ship} tone="violet" />
        <PortalMetricCard title="Entregados" value={packageStats.entregados} subtitle="Procesos completados" icon={Plane} tone="blue" />
      </div>

      {/* Filters */}
      <Card className="border-border/70 bg-card/95 shadow-card">
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
            <div>
              <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
              <TabsList className="grid w-full grid-cols-3 md:grid-cols-7 rounded-[1.25rem] border border-white/80 bg-white/78 p-2 shadow-card backdrop-blur-sm">
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="pre_alerta">Pre-alerta</TabsTrigger>
                <TabsTrigger value="recibido">Recibido</TabsTrigger>
                <TabsTrigger value="rechazado">Rechazado</TabsTrigger>
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
        <Card className="border-border/70 bg-card/95 shadow-card">
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
        <>
        <ClientSectionHeader
          title="Listado de paquetes"
          description="Consulta el detalle de cada registro, sus fotos y el estado actual del proceso."
        />
        <div className="grid gap-3 md:gap-4">
          {filteredPackages.map((pkg) => (
            <Card key={pkg.id} className="border border-border/70 bg-card/95 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-premium">
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
                    {(pkg.package_image_urls && pkg.package_image_urls.length > 0 || pkg.package_image_url) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const gallery = pkg.package_image_urls && pkg.package_image_urls.length > 0 ? pkg.package_image_urls : [pkg.package_image_url];
                          setSelectedGallery(gallery);
                          setSelectedImage(gallery[0]);
                        }}
                        className="text-slate-600 text-xs"
                      >
                        <ImageIcon className="h-3 w-3 mr-1" />
                        Ver Fotos
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
                    <div>
                      Registro: {new Date(pkg.created_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                    {pkg.received_date && (
                      <div className="text-[11px] md:text-xs text-emerald-700">
                        Recibido: {new Date(pkg.received_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' '}{new Date(pkg.received_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    {pkg.seller_delivery_date && (
                      <div className="text-[11px] md:text-xs text-indigo-700">
                        Entrega vendedor: {(() => {
                          const [y, m, d] = String(pkg.seller_delivery_date).split('-');
                          return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
                        })()}
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openSellerDate(pkg)}
                      className="mt-1 text-[11px] md:text-xs"
                    >
                      {pkg.seller_delivery_date ? 'Editar fecha entrega' : 'Agregar fecha entrega'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {hasMore && (
          <Button variant="outline" className="w-full" onClick={() => loadPackages(true)} disabled={loadingMore}>
            {loadingMore ? 'Cargando...' : 'Cargar más'}
          </Button>
        )}
        </>
      )}

      {/* Image Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => { setSelectedImage(null); setSelectedGallery([]); }}>
        <DialogContent className="max-w-xl md:max-w-2xl mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg">Fotos del Paquete</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            {selectedImage && (
              <OptimizedImage
                src={selectedImage}
                alt="Paquete"
                priority
                className="w-full rounded-lg mb-3 aspect-[4/3]"
              />
            )}
            {selectedGallery && selectedGallery.length > 1 && (
              <div className="grid grid-cols-3 gap-2">
                {selectedGallery.map((url, idx) => (
                  <div
                    key={idx}
                    className={`h-20 rounded cursor-pointer overflow-hidden ${selectedImage===url ? 'ring-2 ring-blue-500' : ''}`}
                    onClick={() => setSelectedImage(url)}
                  >
                    <OptimizedImage src={url} alt={`mini-${idx+1}`} className="w-full h-full" />
                  </div>
                ))}
              </div>
            )}
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
            <div>
              <Label>Fecha de entrega del vendedor al almacén</Label>
              <Input
                type="date"
                value={editForm.seller_delivery_date || ''}
                onChange={(e) => setEditForm({ ...editForm, seller_delivery_date: e.target.value })}
                className="mt-1"
              />
              <p className="text-[11px] text-slate-500 mt-1">Fecha en que el vendedor entregó el paquete en el almacén.</p>
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

      {/* Seller Delivery Date Modal */}
      <Dialog open={!!sellerDateModal} onOpenChange={() => setSellerDateModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg">Fecha de entrega del vendedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs md:text-sm text-slate-600">
              Indica la fecha en que el vendedor entregó este paquete en el almacén. Esta información ayudará al equipo a hacer seguimiento.
            </p>
            <div>
              <Label>Fecha</Label>
              <Input
                type="date"
                value={sellerDateValue}
                onChange={(e) => setSellerDateValue(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSellerDateModal(null)}>Cancelar</Button>
            <Button onClick={saveSellerDate} disabled={savingSellerDate} className="bg-blue-600 hover:bg-blue-700">
              {savingSellerDate ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
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