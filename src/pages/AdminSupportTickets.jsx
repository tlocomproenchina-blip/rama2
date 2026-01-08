import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MessageSquare, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  UserCheck,
  Search,
  Filter,
  BarChart3,
  User
} from 'lucide-react';
import { toast } from 'sonner';
import TicketChat from '@/components/support/TicketChat';

export default function AdminSupportTickets({ user }) {
  const [tickets, setTickets] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterAssigned, setFilterAssigned] = useState('all');
  const [assigningTicket, setAssigningTicket] = useState(null);
  const [selectedAdmin, setSelectedAdmin] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [allTickets, adminUsers] = await Promise.all([
      base44.entities.SupportTicket.list('-created_date'),
      base44.entities.User.filter({ role: 'admin' })
    ]);
    setTickets(allTickets);
    setAdmins(adminUsers);
    setLoading(false);
  };

  const handleAssignTicket = async () => {
    if (!selectedAdmin || !assigningTicket) return;

    await base44.entities.SupportTicket.update(assigningTicket.id, {
      assigned_to: selectedAdmin,
      status: assigningTicket.status === 'abierto' ? 'en_proceso' : assigningTicket.status
    });

    // Notify assigned admin
    base44.entities.Notification.create({
      user_email: selectedAdmin,
      title: '📋 Ticket Asignado',
      message: `Se te ha asignado el ticket ${assigningTicket.ticket_number}`,
      type: 'general',
      icon: 'alert',
      reference_id: assigningTicket.id
    }).catch(err => console.error(err));

    // Notify client
    base44.entities.Notification.create({
      user_email: assigningTicket.client_email,
      title: '👨‍💼 Ticket Asignado',
      message: `Tu ticket ${assigningTicket.ticket_number} ha sido asignado a un administrador`,
      type: 'general',
      icon: 'check',
      reference_id: assigningTicket.id
    }).catch(err => console.error(err));

    toast.success('Ticket asignado exitosamente');
    setAssigningTicket(null);
    setSelectedAdmin('');
    loadData();
  };

  const handleStatusChange = async (ticket, newStatus) => {
    const updates = { status: newStatus };
    if (newStatus === 'resuelto' || newStatus === 'cerrado') {
      updates.resolved_date = new Date().toISOString();
    }

    await base44.entities.SupportTicket.update(ticket.id, updates);

    // Notify client
    const statusMessages = {
      en_proceso: 'Tu ticket está siendo atendido',
      resuelto: 'Tu ticket ha sido resuelto',
      cerrado: 'Tu ticket ha sido cerrado'
    };

    if (statusMessages[newStatus]) {
      base44.entities.Notification.create({
        user_email: ticket.client_email,
        title: '🔔 Actualización de Ticket',
        message: `${ticket.ticket_number}: ${statusMessages[newStatus]}`,
        type: 'general',
        icon: 'check',
        reference_id: ticket.id
      }).catch(err => console.error(err));
    }

    toast.success('Estado actualizado');
    loadData();
  };

  const handleSendMessage = async (message) => {
    const newMessage = {
      sender_email: user.email,
      sender_name: user.full_name || user.email,
      message,
      timestamp: new Date().toISOString(),
      is_admin: true
    };

    const updatedMessages = [...(selectedTicket.messages || []), newMessage];
    await base44.entities.SupportTicket.update(selectedTicket.id, {
      messages: updatedMessages
    });

    // Notify client
    base44.entities.Notification.create({
      user_email: selectedTicket.client_email,
      title: '💬 Nueva Respuesta',
      message: `Tienes una nueva respuesta en ${selectedTicket.ticket_number}`,
      type: 'general',
      icon: 'alert',
      reference_id: selectedTicket.id
    }).catch(err => console.error(err));

    setSelectedTicket({ ...selectedTicket, messages: updatedMessages });
    loadData();
  };

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

  // Filter tickets
  const filteredTickets = tickets.filter(ticket => {
    const searchMatch = 
      ticket.ticket_number.toLowerCase().includes(search.toLowerCase()) ||
      ticket.subject.toLowerCase().includes(search.toLowerCase()) ||
      ticket.client_email.toLowerCase().includes(search.toLowerCase());
    
    const statusMatch = filterStatus === 'all' || ticket.status === filterStatus;
    const priorityMatch = filterPriority === 'all' || ticket.priority === filterPriority;
    const assignedMatch = 
      filterAssigned === 'all' || 
      (filterAssigned === 'unassigned' && !ticket.assigned_to) ||
      ticket.assigned_to === filterAssigned;

    return searchMatch && statusMatch && priorityMatch && assignedMatch;
  });

  // Admin statistics
  const adminStats = admins.map(admin => {
    const adminTickets = tickets.filter(t => t.assigned_to === admin.email);
    return {
      admin,
      total: adminTickets.length,
      abierto: adminTickets.filter(t => t.status === 'abierto').length,
      en_proceso: adminTickets.filter(t => t.status === 'en_proceso').length,
      resuelto: adminTickets.filter(t => t.status === 'resuelto').length,
      cerrado: adminTickets.filter(t => t.status === 'cerrado').length
    };
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
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Gestión de Tickets</h1>
        <p className="text-slate-500">Administra y asigna tickets de soporte</p>
      </div>

      <Tabs defaultValue="tickets" className="space-y-6">
        <TabsList>
          <TabsTrigger value="tickets">
            <MessageSquare className="h-4 w-4 mr-2" />
            Tickets
          </TabsTrigger>
          <TabsTrigger value="stats">
            <BarChart3 className="h-4 w-4 mr-2" />
            Estadísticas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="border-0 shadow-md">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Total</p>
                    <p className="text-2xl font-bold text-slate-800">{tickets.length}</p>
                  </div>
                  <MessageSquare className="h-8 w-8 text-slate-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Abiertos</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {tickets.filter(t => t.status === 'abierto').length}
                    </p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">En Proceso</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {tickets.filter(t => t.status === 'en_proceso').length}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Resueltos</p>
                    <p className="text-2xl font-bold text-green-600">
                      {tickets.filter(t => t.status === 'resuelto').length}
                    </p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-green-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Sin Asignar</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {tickets.filter(t => !t.assigned_to).length}
                    </p>
                  </div>
                  <UserCheck className="h-8 w-8 text-orange-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Buscar por número, asunto o email..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="abierto">Abierto</SelectItem>
                    <SelectItem value="en_proceso">En Proceso</SelectItem>
                    <SelectItem value="resuelto">Resuelto</SelectItem>
                    <SelectItem value="cerrado">Cerrado</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger>
                    <SelectValue placeholder="Prioridad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las prioridades</SelectItem>
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterAssigned} onValueChange={setFilterAssigned}>
                  <SelectTrigger>
                    <SelectValue placeholder="Asignación" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="unassigned">Sin asignar</SelectItem>
                    {admins.map(admin => (
                      <SelectItem key={admin.email} value={admin.email}>
                        {admin.full_name || admin.email}
                      </SelectItem>
                    ))}
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
                <h3 className="text-lg font-semibold text-slate-700 mb-2">No se encontraron tickets</h3>
                <p className="text-slate-500">Intenta ajustar los filtros de búsqueda</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredTickets.map((ticket) => {
                const statusInfo = statusConfig[ticket.status];
                const StatusIcon = statusInfo.icon;
                const priorityInfo = priorityConfig[ticket.priority];
                const assignedAdmin = admins.find(a => a.email === ticket.assigned_to);

                return (
                  <Card 
                    key={ticket.id} 
                    className="border-0 shadow-md hover:shadow-lg transition-all"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-3 mb-3">
                            <div 
                              className="flex-1 cursor-pointer"
                              onClick={() => setSelectedTicket(ticket)}
                            >
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <h3 className="font-semibold text-slate-800">{ticket.subject}</h3>
                                <Badge className={priorityInfo.color}>{priorityInfo.label}</Badge>
                                <Badge className={`${statusInfo.color} flex items-center gap-1`}>
                                  <StatusIcon className="h-3 w-3" />
                                  {statusInfo.label}
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-500 font-mono mb-2">{ticket.ticket_number}</p>
                              <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                                <span>Cliente: {ticket.client_email}</span>
                                <span>•</span>
                                <span>Categoría: {ticket.category}</span>
                                <span>•</span>
                                <span>{ticket.messages?.length || 0} mensajes</span>
                                {ticket.related_tracking && (
                                  <>
                                    <span>•</span>
                                    <span>Tracking: {ticket.related_tracking}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {assignedAdmin ? (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                <UserCheck className="h-3 w-3 mr-1" />
                                Asignado a: {assignedAdmin.full_name || assignedAdmin.email}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                Sin asignar
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setAssigningTicket(ticket);
                              setSelectedAdmin(ticket.assigned_to || '');
                            }}
                          >
                            <UserCheck className="h-4 w-4 mr-1" />
                            {ticket.assigned_to ? 'Reasignar' : 'Asignar'}
                          </Button>
                          <Select 
                            value={ticket.status} 
                            onValueChange={(value) => handleStatusChange(ticket, value)}
                          >
                            <SelectTrigger className="h-8">
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
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="stats" className="space-y-6">
          <div className="grid gap-4">
            {adminStats.map((stat) => (
              <Card key={stat.admin.email} className="border-0 shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                        {(stat.admin.full_name?.[0] || stat.admin.email[0]).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800">
                          {stat.admin.full_name || stat.admin.email}
                        </h3>
                        <p className="text-sm text-slate-500">{stat.admin.email}</p>
                      </div>
                    </div>
                    <Badge className="bg-slate-100 text-slate-700">
                      {stat.total} tickets totales
                    </Badge>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <p className="text-xs text-blue-600 mb-1">Abiertos</p>
                      <p className="text-2xl font-bold text-blue-700">{stat.abierto}</p>
                    </div>
                    <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                      <p className="text-xs text-yellow-600 mb-1">En Proceso</p>
                      <p className="text-2xl font-bold text-yellow-700">{stat.en_proceso}</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                      <p className="text-xs text-green-600 mb-1">Resueltos</p>
                      <p className="text-2xl font-bold text-green-700">{stat.resuelto}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <p className="text-xs text-slate-600 mb-1">Cerrados</p>
                      <p className="text-2xl font-bold text-slate-700">{stat.cerrado}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Assign Dialog */}
      <Dialog open={!!assigningTicket} onOpenChange={() => setAssigningTicket(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Ticket</Label>
              <Input value={assigningTicket?.ticket_number || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>Asignar a</Label>
              <Select value={selectedAdmin} onValueChange={setSelectedAdmin}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un administrador" />
                </SelectTrigger>
                <SelectContent>
                  {admins.map(admin => (
                    <SelectItem key={admin.email} value={admin.email}>
                      {admin.full_name || admin.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigningTicket(null)}>
              Cancelar
            </Button>
            <Button onClick={handleAssignTicket} disabled={!selectedAdmin}>
              Asignar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle>{selectedTicket?.subject}</DialogTitle>
                <p className="text-sm text-slate-500 font-mono mt-1">{selectedTicket?.ticket_number}</p>
                <p className="text-sm text-slate-500 mt-1">Cliente: {selectedTicket?.client_email}</p>
              </div>
              <Badge className={statusConfig[selectedTicket?.status]?.color}>
                {statusConfig[selectedTicket?.status]?.label}
              </Badge>
            </div>
          </DialogHeader>
          <TicketChat
            messages={selectedTicket?.messages || []}
            onSendMessage={handleSendMessage}
            currentUserEmail={user.email}
            disabled={false}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}