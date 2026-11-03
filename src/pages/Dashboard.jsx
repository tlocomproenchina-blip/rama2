import React, { useState, useEffect, Suspense, lazy, useCallback, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Edit2,
  Phone,
  DollarSign,
  User,
  Mail,
  MessageCircle,
  Eye,
  FileText,
  Send,
  Plane,
  Ship
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';

import { StatsGridSkeletonLoader } from '@/components/SkeletonLoaders';

// Lazy load non-critical widgets
const ActiveConsolidationsWidget = lazy(() => import('@/components/dashboard/ActiveConsolidationsWidget'));
const RecentPaymentsWidget = lazy(() => import('@/components/dashboard/RecentPaymentsWidget'));
const DeliveryTimesWidget = lazy(() => import('@/components/dashboard/DeliveryTimesWidget'));
const EditProfileModal = lazy(() => import('@/components/EditProfileModal'));

import { toast } from 'sonner';
import { HeaderSkeletonLoader } from '@/components/SkeletonLoaders';
import ClientPageHero from '@/components/client-portal/ClientPageHero';
import PortalMetricCard from '@/components/client-portal/PortalMetricCard';
import ClientSectionHeader from '@/components/client-portal/ClientSectionHeader';
import ShippingLabelGenerator from '@/components/client-portal/ShippingLabelGenerator';
import ShippingMarkExamplesViewer from '@/components/client-portal/ShippingMarkExamplesViewer';
import WarehouseAddressCard from '@/components/client-portal/WarehouseAddressCard';
import ClientCbmWidget from '@/components/client-portal/ClientCbmWidget';
import CreditBalanceWidget from '@/components/client-portal/CreditBalanceWidget';
import ClientQuotesWidget from '@/components/client-portal/ClientQuotesWidget';
import { format } from 'date-fns';

export default function Dashboard({ user, refreshUser }) {
  const [packages, setPackages] = useState([]);
  const [consolidations, setConsolidations] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [config, setConfig] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [newTicket, setNewTicket] = useState({ subject: '', category: 'otro', message: '' });

  const loadData = useCallback(async () => {
    if (!user || !user.email) return;

    try {
      setLoading(true);
      const [configs, pkgs, cons, invs, tkts] = await Promise.all([
        base44.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1),
        base44.entities.Package.filter({ client_email: user.email }, '-updated_date', 100),
        base44.entities.Consolidation.filter({ client_email: user.email }, '-updated_date', 50),
        base44.entities.Invoice.filter({ client_email: user.email }, '-updated_date', 50),
        base44.entities.SupportTicket.filter({ client_email: user.email }, '-created_date', 10)
      ]);

      if (configs.length > 0) setConfig(configs[0]);
      setPackages(pkgs || []);
      setConsolidations(cons || []);
      setInvoices(invs || []);
      setTickets(tkts || []);
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

  const stats = useMemo(() => ({
    preAlerta: packages.filter(p => p.status === 'pre_alerta').length,
    recibidos: packages.filter(p => p.status === 'recibido').length,
    enTransito: consolidations.filter(c => c.status === 'en_transito').length,
    disponibles: consolidations.filter(c => c.status === 'disponible').length,
  }), [packages, consolidations]);

  const pendingApprovalCount = useMemo(() => (
    consolidations.filter(c => c.payment_validated && !c.shipment_approved && c.status !== 'en_transito' && c.status !== 'disponible' && c.status !== 'entregado').length
  ), [consolidations]);

  const portalStats = useMemo(() => ({
    totalPackages: packages.length,
    inTransit: packages.filter(p => p.status === 'en_transito').length + consolidations.filter(c => c.status === 'en_transito').length,
    pendingPayments: invoices.filter(i => i.status === 'pendiente').length,
    openTickets: tickets.filter(t => t.status !== 'cerrado').length,
  }), [packages, consolidations, invoices, tickets]);

  const handleCreateTicket = async () => {
    if (!newTicket.subject || !newTicket.message) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    setCreatingTicket(true);
    try {
      const ticketNumber = `TKT-${Date.now().toString().slice(-8)}`;

      await base44.entities.SupportTicket.create({
        ticket_number: ticketNumber,
        client_email: user.email,
        subject: newTicket.subject,
        category: newTicket.category,
        status: 'abierto',
        priority: 'media',
        messages: [{
          sender_email: user.email,
          sender_name: user.full_name || user.email,
          message: newTicket.message,
          timestamp: new Date().toISOString(),
          is_admin: false
        }]
      });

      const { notifyAdmins } = await import('@/components/NotificationUtils');
      notifyAdmins({
        subject: `🎫 Nuevo ticket de soporte: ${ticketNumber}`,
        body: `Cliente: ${user.full_name || user.email}\nAsunto: ${newTicket.subject}\nCategoría: ${newTicket.category}\n\nMensaje:\n${newTicket.message}`,
        message: `Nuevo ticket de ${user.full_name || user.email}: ${newTicket.subject}`,
        type: 'general',
        icon: 'alert'
      }).catch((error) => {
        console.warn('Admin notification skipped:', error?.message || error);
      });

      toast.success('Ticket creado exitosamente');
      setShowTicketModal(false);
      setNewTicket({ subject: '', category: 'otro', message: '' });
      // Solo recarga tickets — no es necesario recargar paquetes/consolidaciones/facturas
      const tkts = await base44.entities.SupportTicket.filter({ client_email: user.email }, '-created_date', 10);
      setTickets(tkts || []);
    } catch {
      toast.error('Error al crear ticket');
    }
    setCreatingTicket(false);
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
              {/* Left: Shipping Mark + Address */}
              <div className="flex-1 space-y-4 min-w-0">
                <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
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
                  <WarehouseAddressCard user={user} config={config} />
                </div>
              </div>

            </div>

            {/* Ejemplo Shipping Mark + Etiqueta lado a lado */}
            <div className="border-t border-slate-200 pt-4 mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Ejemplos de Shipping Mark (colapsables por plataforma) */}
              {config?.shipping_mark_examples?.length > 0 && (
                <div className="bg-slate-50 rounded-lg p-3 md:p-4 space-y-2">
                  <ShippingMarkExamplesViewer
                    examples={config.shipping_mark_examples}
                    description={config.shipping_mark_example_description}
                  />
                </div>
              )}

              {/* Generate Label */}
              <div className="bg-slate-50 rounded-lg p-4 flex flex-col items-center justify-center text-center">
                <div className="flex items-center justify-center gap-2 text-slate-500 text-xs md:text-sm mb-2">
                  📦 Etiqueta de Envío
                </div>
                <p className="text-xs text-slate-500 mb-3">Genera tu etiqueta en chino para pegar en tus cajas</p>
                <ShippingLabelGenerator user={user} config={config} />
              </div>
            </div>
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

      {/* Saldo a favor del cliente */}
      {hasShippingMark && <CreditBalanceWidget user={user} />}

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

      {/* CBM Widget */}
      {hasShippingMark && <ClientCbmWidget userEmail={user?.email} />}

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

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 gap-2 rounded-[1.5rem] border border-white/80 bg-white/78 p-2 shadow-card backdrop-blur lg:grid-cols-6">
          <TabsTrigger value="overview" className="min-h-[56px] rounded-xl border border-transparent text-center text-sm font-semibold text-slate-600 transition-all data-[state=active]:border-primary/10 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-sky-500 data-[state=active]:text-white data-[state=active]:shadow-card">Resumen</TabsTrigger>
          <TabsTrigger value="quotes" className="min-h-[56px] rounded-xl border border-transparent text-center text-sm font-semibold text-slate-600 transition-all data-[state=active]:border-primary/10 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-sky-500 data-[state=active]:text-white data-[state=active]:shadow-card">Presupuestos</TabsTrigger>
          <TabsTrigger value="packages" className="min-h-[56px] rounded-xl border border-transparent text-center text-sm font-semibold text-slate-600 transition-all data-[state=active]:border-primary/10 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-sky-500 data-[state=active]:text-white data-[state=active]:shadow-card">Paquetes</TabsTrigger>
          <TabsTrigger value="invoices" className="min-h-[56px] rounded-xl border border-transparent text-center text-sm font-semibold text-slate-600 transition-all data-[state=active]:border-primary/10 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-sky-500 data-[state=active]:text-white data-[state=active]:shadow-card">Facturas</TabsTrigger>
          <TabsTrigger value="profile" className="min-h-[56px] rounded-xl border border-transparent text-center text-sm font-semibold text-slate-600 transition-all data-[state=active]:border-primary/10 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-sky-500 data-[state=active]:text-white data-[state=active]:shadow-card">Mi Perfil</TabsTrigger>
          <TabsTrigger value="support" className="min-h-[56px] rounded-xl border border-transparent text-center text-sm font-semibold text-slate-600 transition-all data-[state=active]:border-primary/10 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-sky-500 data-[state=active]:text-white data-[state=active]:shadow-card">Soporte</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <PortalMetricCard title="Paquetes" value={portalStats.totalPackages} subtitle="Total registrados" icon={Package} tone="blue" />
            <PortalMetricCard title="En tránsito" value={portalStats.inTransit} subtitle="Movimientos activos" icon={Truck} tone="amber" />
            <PortalMetricCard title="Pagos pendientes" value={portalStats.pendingPayments} subtitle="Facturas por atender" icon={DollarSign} tone="violet" />
            <PortalMetricCard title="Tickets abiertos" value={portalStats.openTickets} subtitle="Soporte en curso" icon={MessageCircle} tone="blue" />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="border-border/70 bg-card/95 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  Paquetes Recientes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {packages.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">No hay paquetes</p>
                ) : (
                  packages.slice(0, 5).map(pkg => (
                    <div key={pkg.id} className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <div className="flex items-start justify-between mb-2 gap-3">
                        <span className="font-mono text-sm font-medium truncate">{pkg.tracking_number}</span>
                        <StatusBadge status={pkg.status} size="sm" />
                      </div>
                      <p className="text-xs text-slate-600">{pkg.description}</p>
                    </div>
                  ))
                )}
                <Button variant="outline" className="w-full" asChild>
                  <Link to={createPageUrl('MyPackages')}>Ver Todos los Paquetes</Link>
                </Button>
              </CardContent>
            </Card>

            <ClientQuotesWidget userEmail={user?.email} limit={3} />

            <Card className="border-border/70 bg-card/95 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-green-600" />
                  Facturas Recientes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {invoices.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">No hay facturas</p>
                ) : (
                  invoices.slice(0, 5).map(inv => (
                    <div key={inv.id} className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <div className="flex items-start justify-between mb-2 gap-3">
                        <span className="font-mono text-sm font-medium truncate">{inv.invoice_number}</span>
                        <Badge className={
                          inv.status === 'pagada' ? 'bg-green-100 text-green-700' :
                          inv.status === 'pendiente' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }>
                          {inv.status}
                        </Badge>
                      </div>
                      <p className="text-sm font-semibold text-slate-800">${inv.total?.toFixed(2)}</p>
                      <p className="text-xs text-slate-500">{format(new Date(inv.invoice_date), 'dd/MM/yyyy')}</p>
                    </div>
                  ))
                )}
                <Button variant="outline" className="w-full" asChild>
                  <Link to={createPageUrl('MyInvoices')}>Ver Todas las Facturas</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="quotes" className="space-y-4">
          <ClientSectionHeader
            title="Mis Presupuestos"
            description="Revisa los presupuestos que te hemos preparado y completa tus datos cuando estén listos."
          />
          <ClientQuotesWidget userEmail={user?.email} limit={50} showHeader={false} />
        </TabsContent>

        <TabsContent value="packages" className="space-y-4">
          <ClientSectionHeader
            title="Mis Paquetes"
            description="Consulta tus últimos movimientos y crea nuevas pre-alertas."
            action={<Button asChild><Link to={createPageUrl('PreAlert')}>Nueva Pre-alerta</Link></Button>}
          />
          <div className="grid gap-4">
            {packages.length === 0 ? (
              <Card className="border-border/70 bg-card/95 shadow-card"><CardContent className="p-8 text-center text-slate-500">No hay paquetes disponibles.</CardContent></Card>
            ) : packages.map(pkg => (
              <Card key={pkg.id} className="border-border/70 bg-card/95 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-premium">
                <CardContent className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="p-3 bg-blue-100 rounded-xl">
                        {pkg.shipping_type === 'aereo' ? <Plane className="h-6 w-6 text-blue-600" /> : <Ship className="h-6 w-6 text-blue-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono font-semibold text-slate-800 truncate">{pkg.tracking_number}</p>
                        <p className="text-sm text-slate-600 mt-1">{pkg.description}</p>
                        {pkg.shipping_mark && <p className="text-xs text-slate-500 mt-1 font-mono">{pkg.shipping_mark}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={pkg.status} />
                      <Button variant="outline" size="sm" asChild>
                        <Link to={createPageUrl('MyPackages')}><Eye className="h-4 w-4" /></Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Button variant="outline" className="w-full" asChild>
            <Link to={createPageUrl('MyPackages')}>Ver Todos los Paquetes</Link>
          </Button>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <ClientSectionHeader title="Mis Facturas" description="Revisa montos, estados y accesos rápidos a tus documentos." />
          <div className="grid gap-4">
            {invoices.length === 0 ? (
              <Card className="border-border/70 bg-card/95 shadow-card"><CardContent className="p-8 text-center text-slate-500">No hay facturas disponibles.</CardContent></Card>
            ) : invoices.map(inv => (
              <Card key={inv.id} className="border-border/70 bg-card/95 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-premium">
                <CardContent className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="p-3 bg-green-100 rounded-xl"><FileText className="h-6 w-6 text-green-600" /></div>
                      <div>
                        <p className="font-mono font-semibold text-slate-800">{inv.invoice_number}</p>
                        <p className="text-sm text-slate-600 mt-1">{format(new Date(inv.invoice_date), 'dd/MM/yyyy')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-slate-500">Total</p>
                        <p className="text-xl font-bold text-slate-800">${inv.total?.toFixed(2)}</p>
                      </div>
                      <Badge className={
                        inv.status === 'pagada' ? 'bg-green-100 text-green-700' :
                        inv.status === 'pendiente' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }>{inv.status}</Badge>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={createPageUrl('MyInvoices')}><Eye className="h-4 w-4" /></Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Button variant="outline" className="w-full" asChild>
            <Link to={createPageUrl('MyInvoices')}>Ver Todas las Facturas</Link>
          </Button>
        </TabsContent>

        <TabsContent value="profile" className="space-y-4">
          <Card className="border-border/70 bg-card/95 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2"><User className="h-5 w-5 text-blue-600" />Mi Información</span>
                <Button onClick={() => setShowEditProfile(true)} variant="outline" size="sm"><Edit2 className="h-4 w-4 mr-2" />Editar</Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="space-y-1"><Label className="text-xs text-slate-500">Nombre Completo</Label><p className="font-medium text-slate-800">{user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : 'No especificado'}</p></div>
                <div className="space-y-1"><Label className="text-xs text-slate-500 flex items-center gap-1"><Mail className="h-3 w-3" />Email</Label><p className="font-medium text-slate-800">{user.email}</p></div>
                <div className="space-y-1"><Label className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="h-3 w-3" />Ciudad</Label><p className="font-medium text-slate-800">{user.city || 'No especificado'}</p></div>
                <div className="space-y-1"><Label className="text-xs text-slate-500 flex items-center gap-1"><Phone className="h-3 w-3" />WhatsApp</Label><p className="font-medium text-slate-800">{user.whatsapp || 'No especificado'}</p></div>
                <div className="space-y-1"><Label className="text-xs text-slate-500">Shipping Mark</Label><p className="font-mono font-bold text-blue-600 text-lg">{user.shipping_mark || 'Pendiente de asignación'}</p></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="support" className="space-y-4">
          <ClientSectionHeader
            title="Mis Tickets de Soporte"
            description="Sigue tus casos abiertos o crea un nuevo ticket de ayuda."
            action={<Button onClick={() => setShowTicketModal(true)}><MessageCircle className="h-4 w-4 mr-2" />Nuevo Ticket</Button>}
          />
          <div className="grid gap-4">
            {tickets.length === 0 ? (
              <Card className="border-border/70 bg-card/95 shadow-card">
                <CardContent className="p-12 text-center">
                  <MessageCircle className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">No tienes tickets</h3>
                  <p className="text-slate-500 mb-4">Crea un ticket si necesitas ayuda</p>
                  <Button onClick={() => setShowTicketModal(true)} className="bg-blue-600 hover:bg-blue-700">Crear Ticket</Button>
                </CardContent>
              </Card>
            ) : tickets.map(ticket => (
              <Card key={ticket.id} className="border-border/70 bg-card/95 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-premium">
                <CardContent className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <p className="font-mono font-semibold text-slate-800">{ticket.ticket_number}</p>
                        <Badge className={
                          ticket.status === 'cerrado' ? 'bg-slate-100 text-slate-700' :
                          ticket.status === 'resuelto' ? 'bg-green-100 text-green-700' :
                          ticket.status === 'en_proceso' ? 'bg-blue-100 text-blue-700' :
                          'bg-amber-100 text-amber-700'
                        }>{ticket.status}</Badge>
                        <Badge variant="outline">{ticket.priority}</Badge>
                      </div>
                      <p className="text-sm font-medium text-slate-700">{ticket.subject}</p>
                      <p className="text-xs text-slate-500 mt-1">{format(new Date(ticket.created_date), 'dd/MM/yyyy HH:mm')}</p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={createPageUrl('Support')}><Eye className="h-4 w-4 mr-2" />Ver Detalles</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Button variant="outline" className="w-full" asChild>
            <Link to={createPageUrl('Support')}>Ver Todos los Tickets</Link>
          </Button>
        </TabsContent>
      </Tabs>

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

      <Dialog open={showTicketModal} onOpenChange={setShowTicketModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear Ticket de Soporte</DialogTitle>
            <DialogDescription>
              Describe tu problema o pregunta y te responderemos lo antes posible
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Asunto *</Label>
              <Input
                placeholder="Describe brevemente tu consulta"
                value={newTicket.subject}
                onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={newTicket.category} onValueChange={(val) => setNewTicket({ ...newTicket, category: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pago">Pagos</SelectItem>
                  <SelectItem value="envio">Envíos</SelectItem>
                  <SelectItem value="tracking">Tracking</SelectItem>
                  <SelectItem value="consolidacion">Consolidación</SelectItem>
                  <SelectItem value="actualizar_datos">Actualizar datos</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mensaje *</Label>
              <Textarea
                placeholder="Describe tu consulta con el mayor detalle posible..."
                value={newTicket.message}
                onChange={(e) => setNewTicket({ ...newTicket, message: e.target.value })}
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTicketModal(false)}>Cancelar</Button>
            <Button onClick={handleCreateTicket} disabled={creatingTicket} className="bg-blue-600 hover:bg-blue-700">
              {creatingTicket ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creando...</> : <><Send className="h-4 w-4 mr-2" /> Crear Ticket</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}