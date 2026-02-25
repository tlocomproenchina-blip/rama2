import React, { useState, useEffect, Suspense, lazy } from 'react';
import { base44 } from '@/api/base44Client';
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
import EditProfileModal from '@/components/EditProfileModal';
import { PackageSkeletonLoader, ListSkeletonLoader, StatsGridSkeletonLoader } from '@/components/SkeletonLoaders';

// Lazy load non-critical widgets
const ActiveConsolidationsWidget = lazy(() => import('@/components/dashboard/ActiveConsolidationsWidget'));
const RecentPaymentsWidget = lazy(() => import('@/components/dashboard/RecentPaymentsWidget'));
const DeliveryTimesWidget = lazy(() => import('@/components/dashboard/DeliveryTimesWidget'));

import { toast } from 'sonner';
import { HeaderSkeletonLoader } from '@/components/SkeletonLoaders';

export default function Dashboard({ user, refreshUser }) {
  const [packages, setPackages] = useState([]);
  const [consolidations, setConsolidations] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditProfile, setShowEditProfile] = useState(false);

  useEffect(() => {
    if (user && user.email) {
      loadData();
    }
    
    // Real-time updates disabled to prevent rate limiting
    // Users can refresh the page manually to see updates
  }, []);

  const loadData = async () => {
    if (!user || !user.email) return;
    
    try {
      // Load config first (cached, no rate limit issue)
      const configs = await base44.entities.AppConfig.filter({ config_key: 'main' });
      if (configs.length > 0) setConfig(configs[0]);
      
      setLoading(false); // Show UI immediately with config
      
      // Then load user-specific data in sequence with 2 minute delays to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 15000));
      const pkgs = await base44.entities.Package.filter({ client_email: user.email });
      setPackages(pkgs);
      
      await new Promise(resolve => setTimeout(resolve, 120000));
      
      const cons = await base44.entities.Consolidation.filter({ client_email: user.email });
      setConsolidations(cons);
      
      await new Promise(resolve => setTimeout(resolve, 120000));
      
      const invs = await base44.entities.Invoice.filter({ client_email: user.email });
      setInvoices(invs);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      if (error.message?.includes('Rate limit')) {
        toast.error('Demasiadas solicitudes. Espera un momento y recarga la página.');
      } else {
        toast.error('Error al cargar datos. Por favor recarga la página.');
      }
      setLoading(false);
    }
  };

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
    loadData();
  };

  const stats = {
    preAlerta: packages.filter(p => p.status === 'pre_alerta').length,
    recibidos: packages.filter(p => p.status === 'recibido').length,
    enTransito: consolidations.filter(c => c.status === 'en_transito').length,
    disponibles: consolidations.filter(c => c.status === 'disponible').length,
  };

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
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg md:rounded-2xl p-4 md:p-6 lg:p-8 text-white shadow-lg">
        <div className="flex flex-col gap-3 md:gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg md:text-2xl lg:text-3xl font-bold mb-2 break-words">
              ¡Bienvenido, {user?.first_name || 'Usuario'}!
            </h1>
            <p className="text-blue-100 text-xs md:text-sm lg:text-base mb-3 line-clamp-2">
              {hasShippingMark 
                ? 'Gestiona tus envíos y consulta el estado de tus paquetes' 
                : 'Tu perfil está siendo procesado. Pronto recibirás tu Shipping Mark.'
              }
            </p>
            {user?.city && user?.whatsapp && (
              <div className="flex flex-wrap gap-2 md:gap-3 lg:gap-4 text-xs md:text-sm lg:text-base text-blue-100">
                <div className="flex items-center gap-1 md:gap-1.5 lg:gap-2 min-w-0">
                  <MapPin className="h-3 w-3 md:h-3.5 lg:h-4 flex-shrink-0" />
                  <span className="truncate">{user.city}</span>
                </div>
                <div className="flex items-center gap-1 md:gap-1.5 lg:gap-2 min-w-0">
                  <Phone className="h-3 w-3 md:h-3.5 lg:h-4 flex-shrink-0" />
                  <span className="truncate">{user.whatsapp}</span>
                </div>
              </div>
            )}
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowEditProfile(true)}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 w-full md:w-auto mt-2 md:mt-0"
          >
            <Edit2 className="h-4 w-4 mr-2" />
            Editar Contacto
          </Button>
        </div>
      </div>



      {/* Shipping Mark Card */}
      {hasShippingMark ? (
        <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-white">
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
                  <p className="text-xs md:text-sm text-slate-600 mb-3">
                    Esta imagen se mostrará a los usuarios como ejemplo de cómo debe quedar su shipping mark
                  </p>
                  <img 
                    src={config.shipping_mark_example_image_url} 
                    alt="Ejemplo de Shipping Mark" 
                    className="w-full max-w-md mx-auto rounded-lg border border-slate-200 shadow-sm"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-200 bg-amber-50">
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

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 lg:gap-4">
        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-2 md:p-3 lg:p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs md:text-xs lg:text-sm text-slate-500 truncate">Pre-alertas</p>
                <p className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-800">{stats.preAlerta}</p>
              </div>
              <div className="p-2 md:p-2.5 lg:p-3 bg-amber-100 rounded-lg lg:rounded-xl flex-shrink-0">
                <AlertTriangle className="h-4 w-4 md:h-5 lg:h-6 lg:w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-2 md:p-3 lg:p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs md:text-xs lg:text-sm text-slate-500 truncate">Recibidos</p>
                <p className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-800">{stats.recibidos}</p>
              </div>
              <div className="p-2 md:p-2.5 lg:p-3 bg-blue-100 rounded-lg lg:rounded-xl flex-shrink-0">
                <Package className="h-4 w-4 md:h-5 lg:h-6 lg:w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-2 md:p-3 lg:p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs md:text-xs lg:text-sm text-slate-500 truncate">En Tránsito</p>
                <p className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-800">{stats.enTransito}</p>
              </div>
              <div className="p-2 md:p-2.5 lg:p-3 bg-indigo-100 rounded-lg lg:rounded-xl flex-shrink-0">
                <Truck className="h-4 w-4 md:h-5 lg:h-6 lg:w-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-2 md:p-3 lg:p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs md:text-xs lg:text-sm text-slate-500 truncate">Disponibles</p>
                <p className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-800">{stats.disponibles}</p>
              </div>
              <div className="p-2 md:p-2.5 lg:p-3 bg-emerald-100 rounded-lg lg:rounded-xl flex-shrink-0">
                <MapPin className="h-4 w-4 md:h-5 lg:h-6 lg:w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Approval Alert */}
      {consolidations.filter(c => c.payment_validated && !c.shipment_approved && c.status !== 'en_transito' && c.status !== 'disponible' && c.status !== 'entregado').length > 0 && (
        <Card className="border-2 border-blue-300 bg-blue-50 shadow-lg">
          <CardContent className="p-4 lg:p-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3 lg:gap-4 flex-1">
                <div className="p-2.5 lg:p-3 bg-blue-200 rounded-lg lg:rounded-xl flex-shrink-0">
                  <CheckCircle2 className="h-5 w-5 lg:h-6 lg:w-6 text-blue-700" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-blue-900 text-sm lg:text-lg">¡Consolidaciones listas para aprobar!</h3>
                  <p className="text-blue-700 text-xs lg:text-base mt-1">
                    Tienes {consolidations.filter(c => c.payment_validated && !c.shipment_approved && c.status !== 'en_transito' && c.status !== 'disponible' && c.status !== 'entregado').length} consolidación(es) esperando tu aprobación de despacho
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
            <Card className="border-0 shadow-md hover:shadow-xl transition-all cursor-pointer group">
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
            <Card className="border-0 shadow-md hover:shadow-xl transition-all cursor-pointer group">
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

      {/* Recent Packages */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b border-slate-100 p-3 md:p-4 lg:p-6">
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
      <EditProfileModal
        open={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        user={user}
        onUpdate={handleProfileUpdate}
      />
    </div>
  );
}