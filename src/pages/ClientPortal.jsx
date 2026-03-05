import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Package, 
  Truck, 
  DollarSign, 
  User, 
  MapPin, 
  Phone, 
  Mail,
  MessageCircle,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Edit2,
  Save,
  Eye,
  FileText,
  Send,
  Tag,
  Plane,
  Ship
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import EditProfileModal from '@/components/EditProfileModal';
import PullToRefresh from "@/components/common/PullToRefresh";

export default function ClientPortal({ user, refreshUser }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState([]);
  const [consolidations, setConsolidations] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({});
  const [editProfile, setEditProfile] = useState(false);
  const [newTicket, setNewTicket] = useState({
    subject: '',
    category: 'otro',
    message: ''
  });
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    let debounceTimer;
    const debouncedLoadData = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => loadData(), 1000);
    };

    const unsubscribePackages = base44.entities.Package.subscribe((event) => {
      if (event.data?.client_email === user.email) {
        debouncedLoadData();
      }
    });

    const unsubscribeConsolidations = base44.entities.Consolidation.subscribe((event) => {
      if (event.data?.client_email === user.email) {
        debouncedLoadData();
      }
    });

    const unsubscribeInvoices = base44.entities.Invoice.subscribe((event) => {
      if (event.data?.client_email === user.email) {
        debouncedLoadData();
      }
    });

    return () => {
      clearTimeout(debounceTimer);
      unsubscribePackages();
      unsubscribeConsolidations();
      unsubscribeInvoices();
    };
  }, [user]);

  const loadData = async () => {
    try {
      const [pkgs, consols, invs, tkts] = await Promise.all([
        base44.entities.Package.filter({ client_email: user.email }, '-created_date', 5),
        base44.entities.Consolidation.filter({ client_email: user.email }, '-created_date', 5),
        base44.entities.Invoice.filter({ client_email: user.email }, '-created_date', 5),
        base44.entities.SupportTicket.filter({ client_email: user.email }, '-created_date', 5)
      ]);

      setPackages(pkgs);
      setConsolidations(consols);
      setInvoices(invs);
      setTickets(tkts);

      // Calculate stats
      const allPackages = await base44.entities.Package.filter({ client_email: user.email });
      const allConsolidations = await base44.entities.Consolidation.filter({ client_email: user.email });
      const allInvoices = await base44.entities.Invoice.filter({ client_email: user.email });

      setStats({
        totalPackages: allPackages.length,
        inTransit: allPackages.filter(p => p.status === 'en_transito').length + allConsolidations.filter(c => c.status === 'en_transito').length,
        pendingPayments: allInvoices.filter(i => i.status === 'pendiente').length,
        openTickets: tkts.filter(t => t.status !== 'cerrado').length
      });

      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

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

      // Notify admins
      const { notifyAdmins } = await import('@/components/NotificationUtils');
      notifyAdmins({
        subject: `🎫 Nuevo ticket de soporte: ${ticketNumber}`,
        body: `Cliente: ${user.full_name || user.email}\nAsunto: ${newTicket.subject}\nCategoría: ${newTicket.category}\n\nMensaje:\n${newTicket.message}`,
        message: `Nuevo ticket de ${user.full_name || user.email}: ${newTicket.subject}`,
        type: 'general',
        icon: 'alert'
      });

      toast.success('Ticket creado exitosamente');
      setShowTicketModal(false);
      setNewTicket({ subject: '', category: 'otro', message: '' });
      loadData();
    } catch (error) {
      toast.error('Error al crear ticket');
    }
    setCreatingTicket(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PullToRefresh onRefresh={loadData} />
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Mi Portal</h1>
          <p className="text-slate-500 mt-1">
            Bienvenido, {user.first_name || user.email}
          </p>
        </div>
        <Button onClick={() => setShowTicketModal(true)} className="bg-blue-600 hover:bg-blue-700">
          <MessageCircle className="h-4 w-4 mr-2" />
          Crear Ticket de Soporte
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Paquetes</p>
                <p className="text-3xl font-bold text-slate-800">{stats.totalPackages}</p>
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
                <p className="text-3xl font-bold text-slate-800">{stats.inTransit}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-xl">
                <Truck className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pagos Pendientes</p>
                <p className="text-3xl font-bold text-slate-800">{stats.pendingPayments}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-xl">
                <DollarSign className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Tickets Abiertos</p>
                <p className="text-3xl font-bold text-slate-800">{stats.openTickets}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl">
                <MessageCircle className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="packages">Paquetes</TabsTrigger>
          <TabsTrigger value="invoices">Facturas</TabsTrigger>
          <TabsTrigger value="profile">Mi Perfil</TabsTrigger>
          <TabsTrigger value="support">Soporte</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Recent Packages */}
            <Card className="border-0 shadow-lg">
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
                  packages.map(pkg => (
                    <div key={pkg.id} className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-mono text-sm font-medium">{pkg.tracking_number}</span>
                        <StatusBadge status={pkg.status} size="sm" />
                      </div>
                      <p className="text-xs text-slate-600">{pkg.description}</p>
                    </div>
                  ))
                )}
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => navigate(createPageUrl('MyPackages'))}
                >
                  Ver Todos los Paquetes
                </Button>
              </CardContent>
            </Card>

            {/* Recent Invoices */}
            <Card className="border-0 shadow-lg">
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
                  invoices.map(inv => (
                    <div key={inv.id} className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <span className="font-mono text-sm font-medium">{inv.invoice_number}</span>
                        <Badge className={
                          inv.status === 'pagada' ? 'bg-green-100 text-green-700' :
                          inv.status === 'pendiente' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }>
                          {inv.status}
                        </Badge>
                      </div>
                      <p className="text-sm font-semibold text-slate-800">${inv.total?.toFixed(2)}</p>
                      <p className="text-xs text-slate-500">
                        {format(new Date(inv.invoice_date), 'dd/MM/yyyy')}
                      </p>
                    </div>
                  ))
                )}
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => navigate(createPageUrl('MyInvoices'))}
                >
                  Ver Todas las Facturas
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Shipping Mark Info */}
          {user.shipping_mark && (
            <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-purple-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-white rounded-xl shadow-md">
                    <Tag className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-800 mb-1">Tu Shipping Mark</h3>
                    <p className="text-2xl font-bold text-blue-600 font-mono">{user.shipping_mark}</p>
                    <p className="text-sm text-slate-600 mt-1">
                      Usa este código en todas tus compras online
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Packages Tab */}
        <TabsContent value="packages" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-slate-800">Mis Paquetes</h2>
            <Button onClick={() => navigate(createPageUrl('PreAlert'))} className="bg-blue-600 hover:bg-blue-700">
              Nueva Pre-alerta
            </Button>
          </div>
          
          <div className="grid gap-4">
            {packages.map(pkg => (
              <Card key={pkg.id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="p-3 bg-blue-100 rounded-xl">
                        {pkg.shipping_type === 'aereo' ? (
                          <Plane className="h-6 w-6 text-blue-600" />
                        ) : (
                          <Ship className="h-6 w-6 text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-mono font-semibold text-slate-800">{pkg.tracking_number}</p>
                        <p className="text-sm text-slate-600 mt-1">{pkg.description}</p>
                        {pkg.shipping_mark && (
                          <p className="text-xs text-slate-500 mt-1 font-mono">{pkg.shipping_mark}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={pkg.status} />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(createPageUrl('MyPackages'))}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => navigate(createPageUrl('MyPackages'))}
          >
            Ver Todos los Paquetes
          </Button>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-800">Mis Facturas</h2>
          
          <div className="grid gap-4">
            {invoices.map(inv => (
              <Card key={inv.id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="p-3 bg-green-100 rounded-xl">
                        <FileText className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <p className="font-mono font-semibold text-slate-800">{inv.invoice_number}</p>
                        <p className="text-sm text-slate-600 mt-1">
                          {format(new Date(inv.invoice_date), 'dd/MM/yyyy')}
                        </p>
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
                      }>
                        {inv.status}
                      </Badge>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(createPageUrl('MyInvoices'))}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => navigate(createPageUrl('MyInvoices'))}
          >
            Ver Todas las Facturas
          </Button>
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  Mi Información
                </span>
                <Button onClick={() => setEditProfile(true)} variant="outline" size="sm">
                  <Edit2 className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Nombre Completo</Label>
                  <p className="font-medium text-slate-800">
                    {user.first_name && user.last_name 
                      ? `${user.first_name} ${user.last_name}`
                      : 'No especificado'
                    }
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-500 flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    Email
                  </Label>
                  <p className="font-medium text-slate-800">{user.email}</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-500 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Ciudad
                  </Label>
                  <p className="font-medium text-slate-800">{user.city || 'No especificado'}</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-500 flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    WhatsApp
                  </Label>
                  <p className="font-medium text-slate-800">{user.whatsapp || 'No especificado'}</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-500 flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    Shipping Mark
                  </Label>
                  <p className="font-mono font-bold text-blue-600 text-lg">
                    {user.shipping_mark || 'Pendiente de asignación'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Support Tab */}
        <TabsContent value="support" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-slate-800">Mis Tickets de Soporte</h2>
            <Button onClick={() => setShowTicketModal(true)} className="bg-blue-600 hover:bg-blue-700">
              <MessageCircle className="h-4 w-4 mr-2" />
              Nuevo Ticket
            </Button>
          </div>

          <div className="grid gap-4">
            {tickets.length === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="p-12 text-center">
                  <MessageCircle className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">No tienes tickets</h3>
                  <p className="text-slate-500 mb-4">Crea un ticket si necesitas ayuda</p>
                  <Button onClick={() => setShowTicketModal(true)} className="bg-blue-600 hover:bg-blue-700">
                    Crear Ticket
                  </Button>
                </CardContent>
              </Card>
            ) : (
              tickets.map(ticket => (
                <Card key={ticket.id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="font-mono font-semibold text-slate-800">{ticket.ticket_number}</p>
                          <Badge className={
                            ticket.status === 'cerrado' ? 'bg-slate-100 text-slate-700' :
                            ticket.status === 'resuelto' ? 'bg-green-100 text-green-700' :
                            ticket.status === 'en_proceso' ? 'bg-blue-100 text-blue-700' :
                            'bg-amber-100 text-amber-700'
                          }>
                            {ticket.status}
                          </Badge>
                          <Badge variant="outline">{ticket.priority}</Badge>
                        </div>
                        <p className="text-sm font-medium text-slate-700">{ticket.subject}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {format(new Date(ticket.created_date), 'dd/MM/yyyy HH:mm')}
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(createPageUrl('Support'))}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Ver Detalles
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => navigate(createPageUrl('Support'))}
          >
            Ver Todos los Tickets
          </Button>
        </TabsContent>
      </Tabs>

      {/* Edit Profile Modal */}
      <EditProfileModal
        user={user}
        open={editProfile}
        onClose={() => setEditProfile(false)}
        onSave={() => {
          setEditProfile(false);
          refreshUser();
        }}
      />

      {/* Create Ticket Modal */}
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
            <Button variant="outline" onClick={() => setShowTicketModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateTicket} disabled={creatingTicket} className="bg-blue-600 hover:bg-blue-700">
              {creatingTicket ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creando...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" /> Crear Ticket</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}