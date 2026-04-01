import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
  User,
  Plus
} from 'lucide-react';
import { toast } from 'sonner';
import TicketChat from '@/components/support/TicketChat';
import TicketAssignmentDialog from '@/components/support/TicketAssignmentDialog';
import SupportImageUploader from '@/components/support/SupportImageUploader';
import { uploadSupportImages } from '@/components/support/supportUploadUtils';

export default function AdminSupportTickets({ user }) {
  const [tickets, setTickets] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterAssigned, setFilterAssigned] = useState('all');
  const [assigningTicket, setAssigningTicket] = useState(null);
  const [selectedAssignRole, setSelectedAssignRole] = useState('customer_service');
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [newTicket, setNewTicket] = useState({
    client_email: '',
    subject: '',
    category: 'otro',
    priority: 'media',
    message: '',
    related_tracking: '',
    attachments: []
  });

  const isAdmin = user?.role === 'admin';
  const pageSize = 30;
  const roleLabels = {
    admin: 'Administración',
    warehouse: 'Almacén',
    customer_service: 'Servicio al Cliente',
    operations_manager: 'Operaciones'
  };
  const roleByCategory = {
    envio: 'warehouse',
    tracking: 'warehouse',
    consolidacion: 'operations_manager',
    pago: 'customer_service',
    actualizar_datos: 'customer_service',
    otro: 'customer_service'
  };
  const [hasMore, setHasMore] = useState(false);

  const loadData = useCallback(async (append = false) => {
    try {
      if (append) setLoadingMore(true); else setLoading(true);
      const skip = append ? tickets.length : 0;
      const results = await Promise.allSettled([
        base44.entities.SupportTicket.list('-created_date', pageSize, skip),
        isAdmin ? base44.entities.User.list('-created_date', 300) : Promise.resolve([user])
      ]);

      const allT = results[0].status === 'fulfilled' ? results[0].value : [];
      const usersList = results[1].status === 'fulfilled' ? results[1].value : [user];
      const nextStaff = (usersList || []).filter((member) => member.role === 'admin' || ['warehouse', 'customer_service', 'operations_manager'].includes(member.custom_role));
      const nextClients = (usersList || [])
        .filter((member) => member.role === 'user' && !member.custom_role)
        .map((member) => ({
          ...member,
          package_trackings: [],
          package_shipping_marks: [],
        }));

      setTickets((prev) => append ? [...prev, ...allT] : allT);
      setStaffUsers(nextStaff);
      setClients(nextClients);
      setHasMore(allT.length === pageSize);
    } finally {
      if (append) setLoadingMore(false); else setLoading(false);
    }
  }, [isAdmin, pageSize, tickets.length, user]);

  const handleCreateTicket = async () => {
    if (!newTicket.client_email || !newTicket.subject.trim() || !newTicket.message.trim()) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    const ticketNumber = `TKT-${Date.now()}`;
    const uploadedAttachments = await uploadSupportImages(newTicket.attachments);
    const firstMessage = {
      sender_email: user.email,
      sender_name: user.full_name || 'Administrador',
      message: newTicket.message,
      timestamp: new Date().toISOString(),
      is_admin: true,
      attachments: uploadedAttachments
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

    // Notify client (in-app); email is now handled by automation on SupportTicket create
    base44.entities.Notification.create({
      user_email: newTicket.client_email,
      title: '🎫 Nuevo Ticket de Soporte',
      message: `Se ha creado un ticket de soporte para ti: ${newTicket.subject}`,
      type: 'general',
      icon: 'alert',
      reference_id: ticketNumber
    }).catch(err => console.error(err));

    setTickets((prev) => [{
      ticket_number: ticketNumber,
      client_email: newTicket.client_email,
      subject: newTicket.subject,
      category: newTicket.category,
      priority: newTicket.priority,
      related_tracking: newTicket.related_tracking || null,
      status: 'abierto',
      assigned_to: user.email,
      messages: [firstMessage],
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString()
    }, ...prev]);
    toast.success('Ticket creado exitosamente');
    setShowNewTicket(false);
    setClientSearch('');
    setNewTicket({ client_email: '', subject: '', category: 'otro', priority: 'media', message: '', related_tracking: '', attachments: [] });
  };

  const handleAssignTicket = async () => {
    if (!selectedAssignee || !assigningTicket) return;

    const assignee = staffUsers.find((member) => member.email === selectedAssignee);
    const assigneeRole = assignee?.role === 'admin' ? 'admin' : assignee?.custom_role;
    const systemMessage = {
      sender_email: user.email,
      sender_name: user.full_name || 'Administrador',
      message: `Ticket asignado a ${assignee?.full_name || assignee?.email} (${roleLabels[assigneeRole] || assigneeRole || 'equipo'})`,
      timestamp: new Date().toISOString(),
      is_admin: true
    };

    try {
      setAssigning(true);
      await base44.entities.SupportTicket.update(assigningTicket.id, {
        assigned_to: selectedAssignee,
        status: assigningTicket.status === 'abierto' ? 'en_proceso' : assigningTicket.status,
        messages: [...(assigningTicket.messages || []), systemMessage]
      });

      base44.entities.Notification.create({
        user_email: selectedAssignee,
        title: '📋 Ticket Asignado',
        message: `Se te ha asignado el ticket ${assigningTicket.ticket_number}`,
        type: 'general',
        icon: 'alert',
        reference_id: assigningTicket.id
      }).catch(err => console.error(err));

      base44.entities.Notification.create({
        user_email: assigningTicket.client_email,
        title: '👨‍💼 Ticket Asignado',
        message: `Tu ticket ${assigningTicket.ticket_number} ha sido asignado al equipo de ${roleLabels[selectedAssignRole] || 'soporte'}`,
        type: 'general',
        icon: 'check',
        reference_id: assigningTicket.id
      }).catch(err => console.error(err));

      setTickets((prev) => prev.map((item) => item.id === assigningTicket.id ? {
        ...item,
        assigned_to: selectedAssignee,
        status: assigningTicket.status === 'abierto' ? 'en_proceso' : assigningTicket.status,
        messages: [...(assigningTicket.messages || []), systemMessage],
        updated_date: new Date().toISOString()
      } : item));
      if (selectedTicket?.id === assigningTicket.id) {
        setSelectedTicket((prev) => prev ? {
          ...prev,
          assigned_to: selectedAssignee,
          status: assigningTicket.status === 'abierto' ? 'en_proceso' : assigningTicket.status,
          messages: [...(assigningTicket.messages || []), systemMessage]
        } : prev);
      }
      toast.success('Ticket asignado exitosamente');
      setAssigningTicket(null);
      setSelectedAssignee('');
    } catch {
      toast.error('No se pudo asignar el ticket');
    }
    setAssigning(false);
  };

  const handleStatusChange = async (ticket, newStatus) => {
    const updates = { status: newStatus };
    if (newStatus === 'resuelto' || newStatus === 'cerrado') {
      updates.resolved_date = new Date().toISOString();
    }

    try {
      await base44.entities.SupportTicket.update(ticket.id, updates);

      const statusMessages = {
        abierto: 'Tu ticket ha sido reabierto',
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

      if (selectedTicket?.id === ticket.id) {
        setSelectedTicket({ ...selectedTicket, ...updates });
      }
      setTickets((prev) => prev.map((item) => item.id === ticket.id ? { ...item, ...updates, updated_date: new Date().toISOString() } : item));
      toast.success('Estado actualizado');
    } catch {
      toast.error('No se pudo actualizar el estado');
    }
  };

  const handleSendMessage = async (message, files = []) => {
    const uploadedAttachments = await uploadSupportImages(files);
    const newMessage = {
      sender_email: user.email,
      sender_name: user.full_name || user.email,
      message,
      timestamp: new Date().toISOString(),
      is_admin: true,
      attachments: uploadedAttachments
    };

    const updatedMessages = [...(selectedTicket?.messages || []), newMessage];
    try {
      await base44.entities.SupportTicket.update(selectedTicket.id, {
        messages: updatedMessages
      });

      base44.entities.Notification.create({
        user_email: selectedTicket.client_email,
        title: '💬 Nueva Respuesta',
        message: `Tienes una nueva respuesta en ${selectedTicket.ticket_number}`,
        type: 'general',
        icon: 'alert',
        reference_id: selectedTicket.id
      }).catch(err => console.error(err));

      const nextSelectedTicket = { ...selectedTicket, messages: updatedMessages };
      setSelectedTicket(nextSelectedTicket);
      setTickets((prev) => prev.map((ticket) => ticket.id === selectedTicket.id ? { ...ticket, messages: updatedMessages, updated_date: new Date().toISOString() } : ticket));
      toast.success('Respuesta enviada');
      return true;
    } catch {
      toast.error('No se pudo enviar la respuesta');
      return false;
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  // Helper: get timestamp of last client (non-admin) message
  const getLastClientMessageTime = (ticket) => {
    const msgs = ticket.messages || [];
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (!msgs[i].is_admin) return new Date(msgs[i].timestamp).getTime();
    }
    return 0;
  };

  // Helper: check if last message is from client (unread by admin)
  const hasUnreadClientMessage = (ticket) => {
    const msgs = ticket.messages || [];
    if (msgs.length === 0) return false;
    return !msgs[msgs.length - 1].is_admin;
  };

  // Filter tickets
  const filteredTickets = useMemo(() => tickets.filter(ticket => {
    const searchLower = (search || '').toLowerCase();
    const tNum = (ticket.ticket_number || '').toLowerCase();
    const subj = (ticket.subject || '').toLowerCase();
    const email = (ticket.client_email || '').toLowerCase();
    const searchMatch =
      tNum.includes(searchLower) ||
      subj.includes(searchLower) ||
      email.includes(searchLower);
    
    const statusMatch = filterStatus === 'all' || ticket.status === filterStatus;
    const priorityMatch = filterPriority === 'all' || ticket.priority === filterPriority;
    const assignedMatch = 
      filterAssigned === 'all' || 
      (filterAssigned === 'unassigned' && !ticket.assigned_to) ||
      ticket.assigned_to === filterAssigned;

    return searchMatch && statusMatch && priorityMatch && assignedMatch;
  }).sort((a, b) => {
    // Tickets with unread client messages first
    const aUnread = hasUnreadClientMessage(a) ? 1 : 0;
    const bUnread = hasUnreadClientMessage(b) ? 1 : 0;
    if (bUnread !== aUnread) return bUnread - aUnread;
    // Then by last client message time (most recent first)
    const aTime = getLastClientMessageTime(a);
    const bTime = getLastClientMessageTime(b);
    if (aTime !== bTime) return bTime - aTime;
    // Fallback: by creation date
    return new Date(b.created_date).getTime() - new Date(a.created_date).getTime();
  }), [tickets, search, filterStatus, filterPriority, filterAssigned]);

  // Admin statistics — only show staff with tickets assigned
  const adminStats = useMemo(() => staffUsers.map(admin => {
    const adminTickets = tickets.filter(t => t.assigned_to === admin.email);
    return {
      admin,
      total: adminTickets.length,
      abierto: adminTickets.filter(t => t.status === 'abierto').length,
      en_proceso: adminTickets.filter(t => t.status === 'en_proceso').length,
      resuelto: adminTickets.filter(t => t.status === 'resuelto').length,
      cerrado: adminTickets.filter(t => t.status === 'cerrado').length
    };
  }).filter(stat => stat.total > 0), [staffUsers, tickets]);
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestión de Tickets</h1>
          <p className="text-slate-500">Administra y asigna tickets de soporte</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowNewTicket(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Crear Ticket
          </Button>
        )}
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
                    {staffUsers.map(admin => (
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
                const assignedAdmin = staffUsers.find(a => a.email === ticket.assigned_to);
                const assignedRole = assignedAdmin?.role === 'admin' ? 'admin' : assignedAdmin?.custom_role;

                const isUnread = hasUnreadClientMessage(ticket);

                return (
                  <Card 
                    key={ticket.id} 
                    className={`border-0 shadow-md hover:shadow-lg transition-all ${isUnread ? 'ring-2 ring-blue-400 border-l-4 border-l-blue-500' : ''}`}
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
                                {isUnread && (
                                  <Badge className="bg-blue-500 text-white text-[10px] px-2 py-0.5 animate-pulse flex items-center gap-1">
                                    💬 Nuevo mensaje
                                  </Badge>
                                )}
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
                                    <span className="truncate max-w-[200px]" title={ticket.related_tracking}>Tracking: {ticket.related_tracking.split(',').length} paquete(s)</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {assignedAdmin ? (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                <UserCheck className="h-3 w-3 mr-1" />
                                Asignado a: {assignedAdmin.full_name || assignedAdmin.email} · {roleLabels[assignedRole] || assignedRole}
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
                              const currentAssignee = staffUsers.find((member) => member.email === ticket.assigned_to);
                              const currentRole = currentAssignee ? (currentAssignee.role === 'admin' ? 'admin' : currentAssignee.custom_role) : null;
                              setAssigningTicket(ticket);
                              setSelectedAssignRole(currentRole || roleByCategory[ticket.category] || 'customer_service');
                              setSelectedAssignee(ticket.assigned_to || '');
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
          {hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => loadData(true)} disabled={loadingMore}>
                {loadingMore ? 'Cargando...' : 'Cargar más tickets'}
              </Button>
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

      {/* New Ticket Dialog */}
      <Dialog open={showNewTicket} onOpenChange={setShowNewTicket}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear Ticket para Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Buscar cliente por nombre, email, shipping mark o teléfono..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={newTicket.client_email} onValueChange={(value) => setNewTicket({ ...newTicket, client_email: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients
                      .filter(client => {
                        const searchLower = (clientSearch || '').toLowerCase();
                        return (
                          !clientSearch ||
                          (client.first_name || '').toLowerCase().includes(searchLower) ||
                          (client.last_name || '').toLowerCase().includes(searchLower) ||
                          (client.email || '').toLowerCase().includes(searchLower) ||
                          (client.shipping_mark || '').toLowerCase().includes(searchLower) ||
                          (client.package_trackings || []).some((tracking) => (tracking || '').toLowerCase().includes(searchLower)) ||
                          (client.package_shipping_marks || []).some((mark) => (mark || '').toLowerCase().includes(searchLower)) ||
                          (client.whatsapp || '').toLowerCase().includes(searchLower) ||
                          (client.telefono || '').toLowerCase().includes(searchLower) ||
                          (client.phone || '').toLowerCase().includes(searchLower)
                        );
                      })
                      .map((client) => (
                        <SelectItem key={client.email} value={client.email}>
                          {client.first_name} {client.last_name} - {client.email}{client.package_trackings?.[0] ? ` - ${client.package_trackings[0]}` : ''}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
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
                    <SelectItem value="actualizar_datos">Actualizar Datos</SelectItem>
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

            <div className="space-y-2">
              <Label>Fotos (opcional)</Label>
              <SupportImageUploader
                files={newTicket.attachments}
                onChange={(attachments) => setNewTicket({ ...newTicket, attachments })}
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

      <TicketAssignmentDialog
        open={!!assigningTicket}
        onOpenChange={(open) => !open && setAssigningTicket(null)}
        ticket={assigningTicket}
        selectedRole={selectedAssignRole}
        onRoleChange={(value) => {
          setSelectedAssignRole(value);
          setSelectedAssignee('');
        }}
        selectedAssignee={selectedAssignee}
        onAssigneeChange={setSelectedAssignee}
        staffUsers={staffUsers}
        roleLabels={roleLabels}
        onConfirm={handleAssignTicket}
        submitting={assigning}
      />

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle>{selectedTicket?.subject}</DialogTitle>
                <p className="text-sm text-slate-500 font-mono mt-1">{selectedTicket?.ticket_number}</p>
                <p className="text-sm text-slate-500 mt-1">Cliente: {selectedTicket?.client_email}</p>
                {selectedTicket?.related_tracking && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs text-slate-500">Tracking relacionado:</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedTicket.related_tracking.split(',').map((tn, i) => (
                        <Badge key={i} variant="outline" className="font-mono text-xs bg-blue-50 text-blue-700 border-blue-200">
                          {tn.trim()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
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
            disabled={selectedTicket?.status === 'cerrado'}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}