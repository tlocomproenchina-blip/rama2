import React, { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Package, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  Truck,
  MapPin,
  Plus,
  Copy,
  Loader2,
  Building2,
  Edit2,
  Phone
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';

import { PackageSkeletonLoader, ListSkeletonLoader, StatsGridSkeletonLoader } from '@/components/SkeletonLoaders';

// Lazy load non-critical widgets
const ActiveConsolidationsWidget = lazy(() => import('@/components/dashboard/ActiveConsolidationsWidget'));
const RecentPaymentsWidget = lazy(() => import('@/components/dashboard/RecentPaymentsWidget'));
const DeliveryTimesWidget = lazy(() => import('@/components/dashboard/DeliveryTimesWidget'));
const EditProfileModal = lazy(() => import('@/components/EditProfileModal'));

import { toast } from 'sonner';
import { HeaderSkeletonLoader } from '@/components/SkeletonLoaders';
import OptimizedImage from '@/components/OptimizedImage';
import ClientPageHero from '@/components/client-portal/ClientPageHero';
import PortalMetricCard from '@/components/client-portal/PortalMetricCard';
import ClientSectionHeader from '@/components/client-portal/ClientSectionHeader';

export default function Dashboard({ user, refreshUser }) {
  const [packages, setPackages] = useState([]);
  const [consolidations, setConsolidations] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditProfile, setShowEditProfile] = useState(false);

  const loadData = useCallback(async () => {
    if (!user || !user.email) return;

    try {
      setLoading(true);
      const [configs, pkgs, cons, invs] = await Promise.all([
        base44.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1),
        base44.entities.Package.filter({ client_email: user.email }, '-updated_date', 100),
        base44.entities.Consolidation.filter({ client_email: user.email }, '-updated_date', 50),
        base44.entities.Invoice.filter({ client_email: user.email }, '-updated_date', 50)
      ]);

      if (configs.length > 0) setConfig(configs[0]);
      setPackages(pkgs || []);
      setConsolidations(cons || []);
      setInvoices(invs || []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      if (error.message?.includes('Rate limit')) {
        toast.error('Demasiadas solicitudes. Espera un momento y recarga la página.');
      } else {
        toast.error('Error al cargar datos. Por favor recarga la página.');
      }
    }
    setLoading(false);
  }, [user?.email]);

  useEffect(() => {
    if (user?.email) {
      loadData();
    }
  }, [user?.email, loadData]);

  const copyShippingMark = () => {
    navigator.clipboard.writeText(user.shipping_mark);
    toast.success('Shipping Mark copiado');
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(config?.warehouse_address || '');
    toast.success('Dirección copiada');
  };

  const handleProfileUpdate = async () => {
    await refreshUser();
    await loadData();
  };

  const stats = React.useMemo(() => ({
    preAlerta: packages.filter(p => p.status === 'pre_alerta').length,
    recibidos: packages.filter(p => p.status === 'recibido').length,
    enTransito: consolidations.filter(c => c.status === 'en_transito').length,
    disponibles: consolidations.filter(c => c.status === 'disponible').length,
  }), [packages, consolidations]);

  const pendingApprovalCount = React.useMemo(() => (
    consolidations.filter(c => c.payment_validated && !c.shipment_approved && c.status !== 'en_transito' && c.status !== 'disponible' && c.status !== 'entregado').length
  ), [consolidations]);

  if (loading) {
    return (
      <div className="space-y-4 md:space-y-5 lg:space-y-6 w-full">
        <HeaderSkeletonLoader />
        <Card className="border-0 shadow-lg">
          <CardContent className="p-3 md:p-4 lg:p-6">
            <div className="space-y-3">
              <div className="h-6 bg-slate-200 rounded w-24 animate-pulse" />
              <div className="h-4 bg-slate-200 rounded w-full animate-pulse" />
            </div>
          </CardContent>
        </Card>
        <StatsGridSkeletonLoader />
      </div>
    );
  }

  // Check if user has shipping mark
  const hasShippingMark = user?.shipping_mark && user.shipping_mark.length > 0;

  return (
    <div className="space-y-4 md:space-y-6 lg:space-y-8 w-full">
      <ClientPageHero
        icon={Package}
        eyebrow="Panel del cliente"
        title={`¡Bienvenido, ${user?.first_name || 'Usuario'}!`}
        description={hasShippingMark
          ? 'Gestiona tus envíos y consulta el estado de tus paquetes en una vista más clara y premium.'
          : 'Tu perfil está siendo procesado. Pronto recibirás tu Shipping Mark.'}
        badges={[hasShippingMark ? 'Shipping Mark activo' : 'Asignación pendiente'].filter(Boolean)}
        action={
          <Button variant="outline" size="sm" onClick={() => setShowEditProfile(true)}>
            <Edit2 className="h-4 w-4 mr-2" />
            Editar contacto
          </Button>
        }
        aside={
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Resumen rápido</p>
            {user?.city ? (
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <MapPin className="h-4 w-4 text-primary" />
                <span>{user.city}</span>
              </div>
            ) : null}
            {user?.whatsapp ? (
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Phone className="h-4 w-4 text-primary" />
                <span>{user.whatsapp}</span>
              </div>
            ) : null}
            <p className="text-sm text-muted-foreground">Mantén tus datos al día para agilizar soporte, entregas y notificaciones.</p>
          </div>
        }
      />



      {/* Shipping Mark Card */}
      {hasShippingMark ? (
        <Card className="border-border/70 bg-card/95 shadow-card">
          <CardContent className="p-3 md:p-4 lg:p-6">
            <div className="flex flex-col gap-4 md:gap-5 lg:flex-row lg:gap-6">
              {/* Shipping Mark */}
              <div className="flex-1 space-y-2 min-w-0">
                <div className="flex items-center gap-2 text-slate-500 text-xs md:text-sm">
                  <Package className="h-3.5 w-3.5 lg:h-4 lg:w-4 flex-shrink-0" />
                  Tu Shipping Mark
                </div>
                <div className="flex items-center gap-2 md:gap-2.5 lg:gap-3 min-w-0">
                  <span className="text-lg md:text-2xl lg:text-3xl font-bold text-slate-800 font-mono break-all">
                    {user.shipping_mark}
                  </span>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-8 w-8 flex-shrink-0"
                    onClick={copyShippingMark}
                  >
                    <Copy className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                  </Button>
                </div>
              </div>

              {/* Warehouse Address */}
              <div className="flex-1 space-y-2 border-t md:border-t lg:border-t-0 lg:border-l border-slate-200 pt-4 md:pt-4 lg:pt-0 lg:pl-6 min-w-0">
                <div className="flex items-center gap-2 text-slate-500 text-xs md:text-sm">
                  <Building2 className="h-3.5 w-3.5 lg:h-4 lg:w-4 flex-shrink-0" />
                  Dirección del Warehouse
                </div>
                <div className="flex items-start gap-2 md:gap-2.5 lg:gap-3 min-w-0">
                  <p className="text-slate-700 text-xs md:text-sm lg:text-base break-words flex-1 whitespace-pre-line">
                    {config?.warehouse_address || 'Dirección no configurada'}
                  </p>
                  {config?.warehouse_address && (
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-8 w-8 flex-shrink-0"
                      onClick={copyAddress}
                    >
                      <Copy className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Shipping Mark Example Image */}
            {config?.shipping_mark_example_image_url && (
              <div className="border-t border-slate-200 pt-4">
                <div className="flex items-center gap-2 text-slate-500 text-xs md:text-sm mb-3">
                  <Package className="h-3.5 w-3.5 lg:h-4 lg:w-4 flex-shrink-0" />
                  Imagen de ejemplo del Shipping Mark
                </div>
                <div className="bg-slate-50 rounded-lg p-3 md:p-4">
                  <p className="text-xs md:text-sm text-slate-600 mb-3 whitespace-pre-line">
                    {config.shipping_mark_example_description || 'Esta imagen se mostrará a los usuarios como ejemplo de cómo debe quedar su shipping mark'}
                  </p>
                  <OptimizedImage
                    src={config.shipping_mark_example_image_url}
                    alt="Ejemplo de Shipping Mark"
                    width={800}
                    height={600}
                    className="w-full max-w-md mx-auto rounded-lg border border-slate-200 shadow-sm"
                    priority={false}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-200/70 bg-amber-50/90 shadow-card">
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-start gap-3 lg:gap-4">
              <div className="p-2.5 lg:p-3 bg-amber-100 rounded-xl flex-shrink-0">
                <AlertTriangle className="h-5 w-5 lg:h-6 lg:w-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800 text-sm lg:text-base">Shipping Mark Pendiente</h3>
                <p className="text-amber-700 text-xs lg:text-sm mt-1">
                  Tu perfil está completo. Un administrador te asignará tu Shipping Mark pronto.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PortalMetricCard title="Pre-alertas" value={stats.preAlerta} subtitle="Pendientes por recibir" icon={AlertTriangle} tone="amber" />
        <PortalMetricCard title="Recibidos" value={stats.recibidos} subtitle="Paquetes en warehouse" icon={Package} tone="blue" />
        <PortalMetricCard title="En tránsito" value={stats.enTransito} subtitle="Consolidaciones activas" icon={Truck} tone="violet" />
        <PortalMetricCard title="Disponibles" value={stats.disponibles} subtitle="Listos para entrega" icon={MapPin} tone="blue" />
      </div>

      {/* Approval Alert */}
      {pendingApprovalCount > 0 && (
        <Card className="border border-blue-200 bg-blue-50/90 shadow-card">
          <CardContent className="p-4 lg:p-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3 lg:gap-4 flex-1">
                <div className="p-2.5 lg:p-3 bg-blue-200 rounded-lg lg:rounded-xl flex-shrink-0">
                  <CheckCircle2 className="h-5 w-5 lg:h-6 lg:w-6 text-blue-700" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-blue-900 text-sm lg:text-lg">¡Consolidaciones listas para aprobar!</h3>
                  <p className="text-blue-700 text-xs lg:text-base mt-1">
                    Tienes {pendingApprovalCount} consolidación(es) esperando tu aprobación de despacho
                  </p>
                </div>
              </div>
              <Link to={createPageUrl('MyConsolidations')} className="w-full lg:w-auto">
                <Button className="bg-blue-600 hover:bg-blue-700 w-full lg:w-auto">
                  Ver Consolidaciones
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Widgets Section */}
      {hasShippingMark && (
        <Suspense fallback={<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-4">
          {[1,2,3].map(i => <div key={i} className="h-48 bg-slate-200 rounded-lg animate-pulse" />)}
        </div>}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-4">
            <ActiveConsolidationsWidget consolidations={consolidations} />
            <RecentPaymentsWidget invoices={invoices} />
            <DeliveryTimesWidget consolidations={consolidations} />
          </div>
        </Suspense>
      )}

      {/* Quick Actions */}
      {hasShippingMark && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 lg:gap-4">
          <Link to={createPageUrl('PreAlert')}>
            <Card className="border border-border/70 bg-card/95 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-premium cursor-pointer group">
              <CardContent className="p-4 lg:p-6 flex items-center gap-3 lg:gap-4">
                <div className="p-3 lg:p-4 bg-blue-100 rounded-lg lg:rounded-xl group-hover:bg-blue-200 transition-colors flex-shrink-0">
                  <Plus className="h-5 w-5 lg:h-6 lg:w-6 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-base lg:text-lg text-slate-800 truncate">Nueva Pre-alerta</h3>
                  <p className="text-slate-500 text-xs lg:text-sm">Registra un nuevo paquete</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to={createPageUrl('MyConsolidations')}>
            <Card className="border border-border/70 bg-card/95 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-premium cursor-pointer group">
              <CardContent className="p-4 lg:p-6 flex items-center gap-3 lg:gap-4">
                <div className="p-3 lg:p-4 bg-purple-100 rounded-lg lg:rounded-xl group-hover:bg-purple-200 transition-colors flex-shrink-0">
                  <Layers className="h-5 w-5 lg:h-6 lg:w-6 text-purple-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-base lg:text-lg text-slate-800 truncate">Mis Consolidaciones</h3>
                  <p className="text-slate-500 text-xs lg:text-sm">Ver todas tus consolidaciones</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      <ClientSectionHeader
        title="Paquetes recientes"
        description="Consulta tus últimos movimientos y revisa el estado actual de cada envío."
      />
      <Card className="border-border/70 bg-card/95 shadow-card">
        <CardHeader className="border-b border-slate-100/80 p-3 md:p-4 lg:p-6">
          <CardTitle className="text-base md:text-lg font-semibold text-slate-800">Paquetes Recientes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {packages.length === 0 ? (
            <div className="p-4 md:p-8 text-center text-slate-500">
              <Package className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p>No tienes paquetes registrados</p>
              {hasShippingMark && (
                <Link to={createPageUrl('PreAlert')}>
                  <Button className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Pre-alerta
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {packages.slice(0, 5).map((pkg) => (
                <div key={pkg.id} className="p-3 md:p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="p-2 bg-slate-100 rounded-lg flex-shrink-0">
                      <Package className="h-4 w-4 md:h-5 text-slate-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 text-sm md:text-base truncate">{pkg.tracking_number}</p>
                      <p className="text-xs md:text-sm text-slate-500 capitalize">
                        {pkg.shipping_type === 'aereo' ? 'Aéreo' : 'Marítimo'}
                      </p>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <StatusBadge status={pkg.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <Suspense fallback={null}>
          <EditProfileModal
            open={true}
            onClose={() => setShowEditProfile(false)}
            user={user}
            onUpdate={handleProfileUpdate}
          />
        </Suspense>
      )}
    </div>
  );
}