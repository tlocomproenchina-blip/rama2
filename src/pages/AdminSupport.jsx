import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MessageSquare, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  User,
  Filter,
  Plus
} from 'lucide-react';
import { toast } from 'sonner';
import TicketChat from '@/components/support/TicketChat';

export default function AdminSupport({ user }) {
  const [tickets, setTickets] = useState([]);
  const [clients, setClients] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTicket, setNewTicket] = useState({
    client_email: '',
    subject: '',
    category: 'otro',
    priority: 'media',
    message: '',
    related_tracking: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [allTickets, allUsers] = await Promise.all([
      base44.entities.SupportTicket.list('-created_date'),
      base44.entities.User.filter({ role: 'user' })
    ]);

    const clientsMap = {};
    allUsers.forEach(u => { clientsMap[u.email] = u; });

    setTickets(allTickets);
    setClients(clientsMap);
    setLoading(false);
  };

  const handleSendMessage = async (message) => {
    const newMessage = {
      sender_email: user.email,
      sender_name: user.full_name || 'Administrador',
      message,
      timestamp: new Date().toISOString(),
      is_admin: true
    };

    const updatedMessages = [...(selectedTicket.messages || []), newMessage];
    await base44.entities.SupportTicket.update(selectedTicket.id, {
      messages: updatedMessages,
      assigned_to: user.email,
      status: selectedTicket.status === 'abierto' ? 'en_proceso' : selectedTicket.status
    });

    // Notify client
    base44.entities.Notification.create({
      user_email: selectedTicket.client_email,
      title: '💬 Respuesta de Soporte',
      message: `Tienes una nueva respuesta en tu ticket ${selectedTicket.ticket_number}`,
      type: 'general',
      icon: 'check',
      reference_id: selectedTicket.id
    }).catch(err => console.error(err));

    base44.integrations.Core.SendEmail({
      to: selectedTicket.client_email,
      subject: `Respuesta a tu ticket ${selectedTicket.ticket_number}`,
      body: `Hola,\n\nHas recibido una respuesta en tu ticket de soporte:\n\n"${message}"\n\nPuedes responder directamente en el panel de soporte.`
    }).catch(err => console.error(err));

    setSelectedTicket({ ...selectedTicket, messages: updatedMessages });
    loadData();
  };

  const handleCreateTicket = async () => {
    if (!newTicket.client_email || !newTicket.subject.trim() || !newTicket.message.trim()) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    const ticketNumber = `TKT-${Date.now()}`;
    const firstMessage = {
      sender_email: user.email,
      sender_name: user.full_name || 'Administrador',
      message: newTicket.message,
      timestamp: new Date().toISOString(),
      is_admin: true
    };

    await base44.entities.SupportTicket.create({
      ticket_number: ticketNumber,
      client_email: newTicket.client_email,
      subject: newTicket.subject,
      category: newTicket.category,
      priority: newTicket.priority,
      related_tracking: newTicket.related_tracking || null,
      status: 'abierto',
      assigned_to: user.email,
      messages: [firstMessage]
    });

    // Notify client
    base44.entities.Notification.create({
      user_email: newTicket.client_email,
      title: '🎫 Nuevo Ticket de Soporte',
      message: `Se ha creado un ticket de soporte para ti: ${newTicket.subject}`,
      type: 'general',
      icon: 'alert',
      reference_id: ticketNumber
    }).catch(err => console.error(err));

    base44.integrations.Core.SendEmail({
      to: newTicket.client_email,
      subject: `Nuevo Ticket de Soporte - ${ticketNumber}`,
      body: `Hola,\n\nSe ha creado un ticket de soporte para ti:\n\nAsunto: ${newTicket.subject}\nMensaje: ${newTicket.message}\n\nPuedes responder en tu panel de soporte.`
    }).catch(err => console.error(err));

    toast.success('Ticket creado exitosamente');
    setShowNewTicket(false);
    setNewTicket({ client_email: '', subject: '', category: 'otro', priority: 'media', message: '', related_tracking: '' });
    loadData();
  };

  const handleUpdateStatus = async (ticketId, newStatus) => {
    const updates = { status: newStatus };
    if (newStatus === 'resuelto') {
      updates.resolved_date = new Date().toISOString();
    }

    await base44.entities.SupportTicket.update(ticketId, updates);

    // Notify client
    const ticket = tickets.find(t => t.id === ticketId);
    if (ticket) {
      base44.entities.Notification.create({
        user_email: ticket.client_email,
        title: '🎫 Estado de Ticket Actualizado',
        message: `Tu ticket ${ticket.ticket_number} cambió a: ${newStatus}`,
        type: 'general',
        icon: newStatus === 'resuelto' ? 'check' : 'alert',
        reference_id: ticketId
      }).catch(err => console.error(err));
    }

    toast.success('Estado actualizado');
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket({ ...selectedTicket, status: newStatus });
    }
    loadData();
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = 
      ticket.ticket_number.toLowerCase().includes(search.toLowerCase()) ||
      ticket.subject.toLowerCase().includes(search.toLowerCase()) ||
      ticket.client_email.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const statusConfig = {
    abierto: { label: 'Abierto', color: 'bg-blue-100 text-blue-700', icon: AlertCircle },
    en_proceso: { label: 'En Proceso', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    resuelto: { label: 'Resuelto', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    cerrado: { label: 'Cerrado', color: 'bg-slate-100 text-slate-700', icon: XCircle }
  };

  const priorityConfig = {
    baja: { label: 'Baja', color: 'bg-slate-100 text-slate-600' },
    media: { label: 'Media', color: 'bg-blue-100 text-blue-600' },
    alta: { label: 'Alta', color: 'bg-orange-100 text-orange-600' },
    urgente: { label: 'Urgente', color: 'bg-red-100 text-red-600' }
  };

  const stats = {
    total: tickets.length,
    abiertos: tickets.filter(t => t.status === 'abierto').length,
    enProceso: tickets.filter(t => t.status === 'en_proceso').length,
    resueltos: tickets.filter(t => t.status === 'resuelto').length
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestión de Soporte</h1>
          <p className="text-slate-500">Administra los tickets de soporte de clientes</p>
        </div>
        <Button onClick={() => setShowNewTicket(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Crear Ticket
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Tickets</p>
                <p className="text-3xl font-bold text-slate-800">{stats.total}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <MessageSquare className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Abiertos</p>
                <p className="text-3xl font-bold text-slate-800">{stats.abiertos}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <AlertCircle className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">En Proceso</p>
                <p className="text-3xl font-bold text-slate-800">{stats.enProceso}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-xl">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Resueltos</p>
                <p className="text-3xl font-bold text-slate-800">{stats.resueltos}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por ticket, asunto o cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="abierto">Abierto</SelectItem>
                <SelectItem value="en_proceso">En Proceso</SelectItem>
                <SelectItem value="resuelto">Resuelto</SelectItem>
                <SelectItem value="cerrado">Cerrado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      {filteredTickets.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <MessageSquare className="h-16 w-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No hay tickets</h3>
            <p className="text-slate-500">No se encontraron tickets con los filtros seleccionados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredTickets.map((ticket) => {
            const statusInfo = statusConfig[ticket.status];
            const StatusIcon = statusInfo.icon;
            const priorityInfo = priorityConfig[ticket.priority];
            const client = clients[ticket.client_email] || {};

            return (
              <Card 
                key={ticket.id} 
                className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer"
                onClick={() => setSelectedTicket(ticket)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-slate-800">{ticket.subject}</h3>
                        <Badge className={priorityInfo.color}>{priorityInfo.label}</Badge>
                      </div>
                      <p className="text-sm text-slate-500 font-mono mb-1">{ticket.ticket_number}</p>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <User className="h-3 w-3" />
                        {client.first_name} {client.last_name} ({ticket.client_email})
                      </div>
                    </div>
                    <Badge className={`${statusInfo.color} flex items-center gap-1`}>
                      <StatusIcon className="h-3 w-3" />
                      {statusInfo.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>Categoría: {ticket.category}</span>
                    <span>•</span>
                    <span>{ticket.messages?.length || 0} mensajes</span>
                    {ticket.assigned_to && (
                      <>
                        <span>•</span>
                        <span>Asignado a: {ticket.assigned_to}</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Ticket Dialog */}
      <Dialog open={showNewTicket} onOpenChange={setShowNewTicket}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear Ticket para Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select value={newTicket.client_email} onValueChange={(value) => setNewTicket({ ...newTicket, client_email: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un cliente" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(clients).map((client) => (
                    <SelectItem key={client.email} value={client.email}>
                      {client.first_name} {client.last_name} - {client.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Asunto *</Label>
              <Input
                value={newTicket.subject}
                onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                placeholder="Describe brevemente el problema"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select value={newTicket.category} onValueChange={(value) => setNewTicket({ ...newTicket, category: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="envio">Envío</SelectItem>
                    <SelectItem value="tracking">Tracking</SelectItem>
                    <SelectItem value="consolidacion">Consolidación</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select value={newTicket.priority} onValueChange={(value) => setNewTicket({ ...newTicket, priority: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tracking Relacionado (opcional)</Label>
              <Input
                value={newTicket.related_tracking}
                onChange={(e) => setNewTicket({ ...newTicket, related_tracking: e.target.value })}
                placeholder="Ej: TLEC-123456"
              />
            </div>

            <div className="space-y-2">
              <Label>Mensaje Inicial *</Label>
              <Textarea
                value={newTicket.message}
                onChange={(e) => setNewTicket({ ...newTicket, message: e.target.value })}
                placeholder="Mensaje inicial del ticket..."
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTicket(false)}>Cancelar</Button>
            <Button onClick={handleCreateTicket} className="bg-blue-600 hover:bg-blue-700">
              Crear Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <DialogTitle className="text-xl mb-2">{selectedTicket?.subject}</DialogTitle>
                <p className="text-sm text-slate-500 font-mono">{selectedTicket?.ticket_number}</p>
                <div className="flex items-center gap-2 mt-2 text-sm text-slate-600">
                  <User className="h-4 w-4" />
                  {clients[selectedTicket?.client_email]?.first_name} {clients[selectedTicket?.client_email]?.last_name}
                  <span className="text-slate-400">({selectedTicket?.client_email})</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Select 
                  value={selectedTicket?.status} 
                  onValueChange={(value) => handleUpdateStatus(selectedTicket.id, value)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="abierto">Abierto</SelectItem>
                    <SelectItem value="en_proceso">En Proceso</SelectItem>
                    <SelectItem value="resuelto">Resuelto</SelectItem>
                    <SelectItem value="cerrado">Cerrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogHeader>
          <TicketChat
            messages={selectedTicket?.messages || []}
            onSendMessage={handleSendMessage}
            currentUserEmail={user.email}
            disabled={selectedTicket?.status === 'cerrado'}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}