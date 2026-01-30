import React, { useState, useEffect } from 'react';
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
import ActiveConsolidationsWidget from '@/components/dashboard/ActiveConsolidationsWidget';
import RecentPaymentsWidget from '@/components/dashboard/RecentPaymentsWidget';
import DeliveryTimesWidget from '@/components/dashboard/DeliveryTimesWidget';
import { toast } from 'sonner';

export default function Dashboard({ user, refreshUser }) {
  const [packages, setPackages] = useState([]);
  const [consolidations, setConsolidations] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditProfile, setShowEditProfile] = useState(false);

  useEffect(() => {
    loadData();
    
    // Real-time updates
    if (user) {
      const unsubscribePackages = base44.entities.Package.subscribe((event) => {
        loadData();
      });
      
      const unsubscribeConsolidations = base44.entities.Consolidation.subscribe((event) => {
        loadData();
      });
      
      return () => {
        unsubscribePackages();
        unsubscribeConsolidations();
      };
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    
    const [pkgs, cons, invs, configs] = await Promise.all([
      base44.entities.Package.filter({ client_email: user.email }),
      base44.entities.Consolidation.filter({ client_email: user.email }),
      base44.entities.Invoice.filter({ client_email: user.email }),
      base44.entities.AppConfig.filter({ config_key: 'main' })
    ]);
    
    setPackages(pkgs);
    setConsolidations(cons);
    setInvoices(invs);
    if (configs.length > 0) setConfig(configs[0]);
    setLoading(false);
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Check if user has shipping mark
  const hasShippingMark = user?.shipping_mark && user.shipping_mark.length > 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 lg:p-8 text-white shadow-xl">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-2xl lg:text-3xl font-bold mb-2">
              ¡Bienvenido, {user?.first_name || 'Usuario'}!
            </h1>
            <p className="text-blue-100 mb-3">
              {hasShippingMark 
                ? 'Gestiona tus envíos y consulta el estado de tus paquetes' 
                : 'Tu perfil está siendo procesado. Pronto recibirás tu Shipping Mark.'
              }
            </p>
            {user?.city && user?.whatsapp && (
              <div className="flex flex-wrap gap-4 text-sm text-blue-100">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {user.city}
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  {user.whatsapp}
                </div>
              </div>
            )}
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowEditProfile(true)}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            <Edit2 className="h-4 w-4 mr-2" />
            Editar Contacto
          </Button>
        </div>
      </div>

      {/* Shipping Mark Card */}
      {hasShippingMark ? (
        <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-white">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Shipping Mark */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <Package className="h-4 w-4" />
                  Tu Shipping Mark
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl lg:text-3xl font-bold text-slate-800 font-mono">
                    {user.shipping_mark}
                  </span>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={copyShippingMark}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Warehouse Address */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <Building2 className="h-4 w-4" />
                  Dirección del Warehouse
                </div>
                <div className="flex items-start gap-3">
                  <p className="text-slate-700 text-sm lg:text-base whitespace-pre-line">
                    {config?.warehouse_address || 'Dirección no configurada'}
                  </p>
                  {config?.warehouse_address && (
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-8 w-8 flex-shrink-0"
                      onClick={copyAddress}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-xl">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-800">Shipping Mark Pendiente</h3>
                <p className="text-amber-700 text-sm">
                  Tu perfil está completo. Un administrador te asignará tu Shipping Mark pronto.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pre-alertas</p>
                <p className="text-3xl font-bold text-slate-800">{stats.preAlerta}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-xl">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Recibidos</p>
                <p className="text-3xl font-bold text-slate-800">{stats.recibidos}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">En Tránsito</p>
                <p className="text-3xl font-bold text-slate-800">{stats.enTransito}</p>
              </div>
              <div className="p-3 bg-indigo-100 rounded-xl">
                <Truck className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Disponibles</p>
                <p className="text-3xl font-bold text-slate-800">{stats.disponibles}</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-xl">
                <MapPin className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Approval Alert */}
      {consolidations.filter(c => c.payment_validated && !c.shipment_approved && c.status !== 'en_transito' && c.status !== 'disponible' && c.status !== 'entregado').length > 0 && (
        <Card className="border-2 border-blue-300 bg-blue-50 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-200 rounded-xl">
                  <CheckCircle2 className="h-6 w-6 text-blue-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900 text-lg">¡Consolidaciones listas para aprobar!</h3>
                  <p className="text-blue-700">
                    Tienes {consolidations.filter(c => c.payment_validated && !c.shipment_approved && c.status !== 'en_transito' && c.status !== 'disponible' && c.status !== 'entregado').length} consolidación(es) esperando tu aprobación de despacho
                  </p>
                </div>
              </div>
              <Link to={createPageUrl('MyConsolidations')}>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Ver Consolidaciones
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Widgets Section */}
      {hasShippingMark && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ActiveConsolidationsWidget consolidations={consolidations} />
          <RecentPaymentsWidget invoices={invoices} />
          <DeliveryTimesWidget consolidations={consolidations} />
        </div>
      )}

      {/* Quick Actions */}
      {hasShippingMark && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Link to={createPageUrl('PreAlert')}>
            <Card className="border-0 shadow-md hover:shadow-xl transition-all cursor-pointer group">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-4 bg-blue-100 rounded-xl group-hover:bg-blue-200 transition-colors">
                  <Plus className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-slate-800">Nueva Pre-alerta</h3>
                  <p className="text-slate-500 text-sm">Registra un nuevo paquete</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to={createPageUrl('MyConsolidations')}>
            <Card className="border-0 shadow-md hover:shadow-xl transition-all cursor-pointer group">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-4 bg-purple-100 rounded-xl group-hover:bg-purple-200 transition-colors">
                  <Layers className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-slate-800">Mis Consolidaciones</h3>
                  <p className="text-slate-500 text-sm">Ver todas tus consolidaciones</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      {/* Recent Packages */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-lg font-semibold text-slate-800">Paquetes Recientes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {packages.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
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
            <div className="divide-y divide-slate-100">
              {packages.slice(0, 5).map((pkg) => (
                <div key={pkg.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-slate-100 rounded-lg">
                      <Package className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{pkg.tracking_number}</p>
                      <p className="text-sm text-slate-500 capitalize">
                        {pkg.shipping_type === 'aereo' ? 'Aéreo' : 'Marítimo'}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={pkg.status} />
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