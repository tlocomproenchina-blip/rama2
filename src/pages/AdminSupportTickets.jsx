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
import TicketAssignmentDialog from '@/components/support/TicketAssignmentDialog';
import { uploadSupportImages } from '@/components/support/supportUploadUtils';
import AdminSupportHeader from '@/components/support/AdminSupportHeader';
import AdminSupportStatsCards from '@/components/support/AdminSupportStatsCards';
import AdminSupportFilters from '@/components/support/AdminSupportFilters';
import AdminSupportTicketsList from '@/components/support/AdminSupportTicketsList';
import AdminSupportAdminStats from '@/components/support/AdminSupportAdminStats';
import AdminSupportKpiFilters from '@/components/support/AdminSupportKpiFilters';
import AdminSupportRealtimeKpis from '@/components/support/AdminSupportRealtimeKpis';
import AdminSupportChartsPanel from '@/components/support/AdminSupportChartsPanel';
import AdminSupportNewTicketDialog from '@/components/support/AdminSupportNewTicketDialog';
import AdminSupportTicketDetailDialog from '@/components/support/AdminSupportTicketDetailDialog';

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
  const [filterDate, setFilterDate] = useState('all');
  const [assigningTicket, setAssigningTicket] = useState(null);
  const [selectedAssignRole, setSelectedAssignRole] = useState('customer_service');
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [clients, setClients] = useState([]);
  const [kpiFilters, setKpiFilters] = useState({ range: 'all', agent: 'all', status: 'all' });
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
  const [openedTicketIds, setOpenedTicketIds] = useState(() => {
    try {
      const saved = localStorage.getItem('adminSupportOpenedTicketIds');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [manuallyUnreadTicketIds, setManuallyUnreadTicketIds] = useState(() => {
    try {
      const saved = localStorage.getItem('adminSupportManuallyUnreadTicketIds');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const loadData = useCallback(async (append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

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

      setTickets((prev) => (append ? [...prev, ...allT] : allT));
      setStaffUsers(nextStaff);
      setClients(nextClients);
      setHasMore(allT.length === pageSize);
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
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
    const trackingCount = (selectedTicket?.related_tracking || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean).length;
    const uploadedAttachments = await uploadSupportImages(files, Math.max(1, trackingCount || 3));
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

  const handleMarkAsUnread = (ticket) => {
    const messages = ticket?.messages || [];
    const lastClientMessage = [...messages].reverse().find((msg) => !msg.is_admin);

    if (lastClientMessage) {
      const lastMessageKey = `${ticket.id}:${lastClientMessage.timestamp}`;
      setOpenedTicketIds((prev) => prev.filter((item) => item !== lastMessageKey));
    }

    setManuallyUnreadTicketIds((prev) => prev.includes(ticket.id) ? prev : [...prev, ticket.id]);
    toast.success('Ticket marcado como no visto');
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    localStorage.setItem('adminSupportOpenedTicketIds', JSON.stringify(openedTicketIds));
  }, [openedTicketIds]);

  useEffect(() => {
    localStorage.setItem('adminSupportManuallyUnreadTicketIds', JSON.stringify(manuallyUnreadTicketIds));
  }, [manuallyUnreadTicketIds]);

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

  // Helper: check if ticket should show as unread by admin
  const hasUnreadClientMessage = (ticket) => {
    if (manuallyUnreadTicketIds.includes(ticket.id)) return true;
    const msgs = ticket.messages || [];
    const lastClientMessage = [...msgs].reverse().find((msg) => !msg.is_admin);
    if (!lastClientMessage) return false;
    const lastMessageKey = `${ticket.id}:${lastClientMessage.timestamp}`;
    return !openedTicketIds.includes(lastMessageKey);
  };

  // Filter tickets
  const filteredTickets = useMemo(() => tickets.filter(ticket => {
    const searchLower = (search || '').toLowerCase();
    const tNum = (ticket.ticket_number || '').toLowerCase();
    const subj = (ticket.subject || '').toLowerCase();
    const email = (ticket.client_email || '').toLowerCase();
    const client = clients.find((item) => item.email === ticket.client_email);
    const shippingMark = (client?.shipping_mark || '').toLowerCase();
    const searchMatch =
      tNum.includes(searchLower) ||
      subj.includes(searchLower) ||
      email.includes(searchLower) ||
      shippingMark.includes(searchLower);
    
    const statusMatch = filterStatus === 'all' || ticket.status === filterStatus;
    const priorityMatch = filterPriority === 'all' || ticket.priority === filterPriority;
    const assignedMatch = 
      filterAssigned === 'all' || 
      (filterAssigned === 'unassigned' && !ticket.assigned_to) ||
      ticket.assigned_to === filterAssigned;

    const ticketTime = new Date(ticket.updated_date || ticket.created_date || 0).getTime();
    const now = Date.now();
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    const dateMatch =
      filterDate === 'all' ||
      (filterDate === 'today' && ticketTime >= startOfToday) ||
      (filterDate === '7d' && ticketTime >= now - (7 * 24 * 60 * 60 * 1000)) ||
      (filterDate === '30d' && ticketTime >= now - (30 * 24 * 60 * 60 * 1000));

    return searchMatch && statusMatch && priorityMatch && assignedMatch && dateMatch;
  }).sort((a, b) => {
    const aUpdated = new Date(a.updated_date || a.created_date || 0).getTime();
    const bUpdated = new Date(b.updated_date || b.created_date || 0).getTime();
    if (aUpdated !== bUpdated) return bUpdated - aUpdated;

    const aUnread = hasUnreadClientMessage(a) ? 1 : 0;
    const bUnread = hasUnreadClientMessage(b) ? 1 : 0;
    if (bUnread !== aUnread) return bUnread - aUnread;

    const aTime = getLastClientMessageTime(a);
    const bTime = getLastClientMessageTime(b);
    if (aTime !== bTime) return bTime - aTime;

    return new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime();
  }), [tickets, search, filterStatus, filterPriority, filterAssigned, filterDate]);

  const filteredKpiTickets = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return tickets.filter((ticket) => {
      const ticketTime = new Date(ticket.updated_date || ticket.created_date).getTime();
      const matchesRange =
        kpiFilters.range === 'all' ||
        (kpiFilters.range === 'today' && ticketTime >= startOfToday) ||
        (kpiFilters.range === '7d' && ticketTime >= now.getTime() - (7 * 24 * 60 * 60 * 1000)) ||
        (kpiFilters.range === '30d' && ticketTime >= now.getTime() - (30 * 24 * 60 * 60 * 1000));

      const matchesAgent =
        kpiFilters.agent === 'all' ||
        (kpiFilters.agent === 'unassigned' && !ticket.assigned_to) ||
        ticket.assigned_to === kpiFilters.agent;

      const matchesStatus = kpiFilters.status === 'all' || ticket.status === kpiFilters.status;

      return matchesRange && matchesAgent && matchesStatus;
    });
  }, [tickets, kpiFilters]);

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
      <AdminSupportHeader isAdmin={isAdmin} onCreateTicket={() => setShowNewTicket(true)} />

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
          <AdminSupportStatsCards tickets={tickets} />
          <AdminSupportFilters
            search={search}
            setSearch={setSearch}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            filterPriority={filterPriority}
            setFilterPriority={setFilterPriority}
            filterAssigned={filterAssigned}
            setFilterAssigned={setFilterAssigned}
            filterDate={filterDate}
            setFilterDate={setFilterDate}
            staffUsers={staffUsers}
          />
          <AdminSupportTicketsList
            filteredTickets={filteredTickets}
            staffUsers={staffUsers}
            roleLabels={roleLabels}
            roleByCategory={roleByCategory}
            statusConfig={statusConfig}
            priorityConfig={priorityConfig}
            hasUnreadClientMessage={hasUnreadClientMessage}
            setSelectedTicket={setSelectedTicket}
            setOpenedTicketIds={setOpenedTicketIds}
            setManuallyUnreadTicketIds={setManuallyUnreadTicketIds}
            setAssigningTicket={setAssigningTicket}
            setSelectedAssignRole={setSelectedAssignRole}
            setSelectedAssignee={setSelectedAssignee}
            handleStatusChange={handleStatusChange}
            handleMarkAsUnread={handleMarkAsUnread}
          />
          {hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => loadData(true)} disabled={loadingMore}>
                {loadingMore ? 'Cargando...' : 'Cargar más tickets'}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="stats" className="space-y-6">
          <AdminSupportKpiFilters filters={kpiFilters} setFilters={setKpiFilters} staffUsers={staffUsers} />
          <AdminSupportRealtimeKpis tickets={filteredKpiTickets} staffUsers={staffUsers} />
          <AdminSupportChartsPanel tickets={filteredKpiTickets} staffUsers={staffUsers} />
          <AdminSupportAdminStats adminStats={adminStats} />
        </TabsContent>
      </Tabs>

      <AdminSupportNewTicketDialog
        showNewTicket={showNewTicket}
        setShowNewTicket={setShowNewTicket}
        clientSearch={clientSearch}
        setClientSearch={setClientSearch}
        newTicket={newTicket}
        setNewTicket={setNewTicket}
        clients={clients}
        handleCreateTicket={handleCreateTicket}
      />

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

      <AdminSupportTicketDetailDialog
        selectedTicket={selectedTicket ? {
          ...tickets.find((ticket) => ticket.id === selectedTicket.id) || selectedTicket,
          client: clients.find((client) => client.email === selectedTicket.client_email) || null
        } : null}
        setSelectedTicket={setSelectedTicket}
        statusConfig={statusConfig}
        handleSendMessage={handleSendMessage}
        user={user}
      />
    </div>
  );
}