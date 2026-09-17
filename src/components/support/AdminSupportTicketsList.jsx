import React from 'react';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Mail, MessageSquare, UserCheck, Bot, AlertTriangle, Clock } from 'lucide-react';

export default function AdminSupportTicketsList({
  filteredTickets,
  selectedTicketIds = [],
  setSelectedTicketIds = () => {},
  staffUsers,
  roleLabels,
  roleByCategory,
  statusConfig,
  priorityConfig,
  hasUnreadClientMessage,
  setSelectedTicket,
  setOpenedTicketIds,
  setManuallyUnreadTicketIds,
  setAssigningTicket,
  setSelectedAssignRole,
  setSelectedAssignee,
  handleStatusChange,
  handleMarkAsUnread
}) {
  if (filteredTickets.length === 0) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="p-12 text-center">
          <MessageSquare className="h-16 w-16 mx-auto mb-4 text-slate-300" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No se encontraron tickets</h3>
          <p className="text-slate-500">Intenta ajustar los filtros de búsqueda</p>
        </CardContent>
      </Card>
    );
  }

  const allSelected = filteredTickets.length > 0 && filteredTickets.every((t) => selectedTicketIds.includes(t.id));
  const toggleSelectAll = () => {
    setSelectedTicketIds(allSelected ? [] : filteredTickets.map((t) => t.id));
  };
  const toggleSelect = (id) => {
    setSelectedTicketIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]);
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2 px-2">
        <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} id="select-all-tickets" />
        <label htmlFor="select-all-tickets" className="text-sm text-slate-600 cursor-pointer select-none">
          Seleccionar todos ({filteredTickets.length})
        </label>
      </div>
      {filteredTickets.map((ticket) => {
        const statusInfo = statusConfig[ticket.status];
        const StatusIcon = statusInfo.icon;
        const priorityInfo = priorityConfig[ticket.priority];
        const assignedAdmin = staffUsers.find((a) => a.email === ticket.assigned_to);
        const assignedRole = assignedAdmin?.role === 'admin' ? 'admin' : assignedAdmin?.custom_role;
        const isUnread = hasUnreadClientMessage(ticket);
        const lastMessage = ticket.messages?.[ticket.messages.length - 1];
        const lastMessageDate = lastMessage?.timestamp ? format(new Date(lastMessage.timestamp), 'dd/MM/yyyy HH:mm') : null;

        return (
          <Card
            key={ticket.id}
            className={`border-0 shadow-md hover:shadow-lg transition-all ${isUnread ? 'ring-2 ring-blue-400 border-l-4 border-l-blue-500' : ''}`}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="pt-1">
                  <Checkbox
                    checked={selectedTicketIds.includes(ticket.id)}
                    onCheckedChange={() => toggleSelect(ticket.id)}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => {
                        setSelectedTicket(ticket);
                        setManuallyUnreadTicketIds((prev) => prev.filter((item) => item !== ticket.id));
                        const lastClientMessage = [...(ticket.messages || [])].reverse().find((msg) => !msg.is_admin);
                        if (!lastClientMessage) return;
                        const lastMessageKey = `${ticket.id}:${lastClientMessage.timestamp}`;
                        setOpenedTicketIds((prev) => prev.includes(lastMessageKey) ? prev : [...prev, lastMessageKey]);
                      }}
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
                        {ticket.ai_pending_draft && (
                          <Badge className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 flex items-center gap-1 border border-amber-300">
                            <Bot className="h-3 w-3" />
                            Borrador IA pendiente
                          </Badge>
                        )}
                        {ticket.ai_escalated && (
                          <Badge className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 flex items-center gap-1 border border-red-300">
                            <AlertTriangle className="h-3 w-3" />
                            Escalado a humano
                          </Badge>
                        )}
                        {ticket.auto_closed && (
                          <Badge className="bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 flex items-center gap-1 border border-slate-300">
                            <Clock className="h-3 w-3" />
                            Cerrado por inactividad
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
                        {lastMessageDate && (
                          <>
                            <span>•</span>
                            <span>Último mensaje: {lastMessageDate}</span>
                          </>
                        )}
                        {ticket.related_tracking && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[200px]" title={ticket.related_tracking}>
                              Tracking: {ticket.related_tracking.split(',').length} paquete(s)
                            </span>
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
                  {!isUnread && (
                    <Button variant="outline" size="sm" onClick={() => handleMarkAsUnread(ticket)}>
                      <Mail className="h-4 w-4 mr-1" />
                      No visto
                    </Button>
                  )}
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
                  <Select value={ticket.status} onValueChange={(value) => handleStatusChange(ticket, value)}>
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
  );
}