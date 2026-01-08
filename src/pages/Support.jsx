import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  MessageSquare, 
  Plus, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import TicketChat from '@/components/support/TicketChat';

export default function Support({ user }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [newTicket, setNewTicket] = useState({
    subject: '',
    category: 'otro',
    priority: 'media',
    message: '',
    related_tracking: ''
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    const allTickets = await base44.entities.SupportTicket.filter({ client_email: user.email }, '-created_date');
    setTickets(allTickets);
    setLoading(false);
  };

  const handleCreateTicket = async () => {
    if (!newTicket.subject.trim() || !newTicket.message.trim()) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    const ticketNumber = `TKT-${Date.now()}`;
    const firstMessage = {
      sender_email: user.email,
      sender_name: user.full_name || user.email,
      message: newTicket.message,
      timestamp: new Date().toISOString(),
      is_admin: false
    };

    await base44.entities.SupportTicket.create({
      ticket_number: ticketNumber,
      client_email: user.email,
      subject: newTicket.subject,
      category: newTicket.category,
      priority: newTicket.priority,
      related_tracking: newTicket.related_tracking || null,
      status: 'abierto',
      messages: [firstMessage]
    });

    // Notify admins
    const admins = await base44.entities.User.filter({ role: 'admin' });
    for (const admin of admins) {
      base44.entities.Notification.create({
        user_email: admin.email,
        title: '🎫 Nuevo Ticket de Soporte',
        message: `${user.full_name || user.email} creó un ticket: ${newTicket.subject}`,
        type: 'general',
        icon: 'alert',
        reference_id: ticketNumber
      }).catch(err => console.error(err));
    }

    toast.success('Ticket creado exitosamente');
    setShowNewTicket(false);
    setNewTicket({ subject: '', category: 'otro', priority: 'media', message: '', related_tracking: '' });
    loadTickets();
  };

  const handleSendMessage = async (message) => {
    const newMessage = {
      sender_email: user.email,
      sender_name: user.full_name || user.email,
      message,
      timestamp: new Date().toISOString(),
      is_admin: false
    };

    const updatedMessages = [...(selectedTicket.messages || []), newMessage];
    await base44.entities.SupportTicket.update(selectedTicket.id, {
      messages: updatedMessages,
      status: selectedTicket.status === 'resuelto' ? 'abierto' : selectedTicket.status
    });

    // Notify admin
    if (selectedTicket.assigned_to) {
      base44.entities.Notification.create({
        user_email: selectedTicket.assigned_to,
        title: '💬 Nuevo mensaje en ticket',
        message: `${user.full_name || user.email} respondió en ${selectedTicket.ticket_number}`,
        type: 'general',
        icon: 'alert',
        reference_id: selectedTicket.id
      }).catch(err => console.error(err));
    }

    setSelectedTicket({ ...selectedTicket, messages: updatedMessages });
    loadTickets();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Soporte</h1>
          <p className="text-slate-500">Gestiona tus tickets de soporte</p>
        </div>
        <Button onClick={() => setShowNewTicket(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Ticket
        </Button>
      </div>

      {/* Tickets List */}
      {tickets.length === 0 ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <MessageSquare className="h-16 w-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No tienes tickets</h3>
            <p className="text-slate-500 mb-4">Crea tu primer ticket para contactar con soporte</p>
            <Button onClick={() => setShowNewTicket(true)} className="bg-blue-600 hover:bg-blue-700">
              Crear Ticket
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tickets.map((ticket) => {
            const statusInfo = statusConfig[ticket.status];
            const StatusIcon = statusInfo.icon;
            const priorityInfo = priorityConfig[ticket.priority];

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
                      <p className="text-sm text-slate-500 font-mono">{ticket.ticket_number}</p>
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
                    {ticket.related_tracking && (
                      <>
                        <span>•</span>
                        <span>Tracking: {ticket.related_tracking}</span>
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
            <DialogTitle>Crear Nuevo Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Asunto *</Label>
              <Input
                value={newTicket.subject}
                onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                placeholder="Describe brevemente tu problema"
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
              <Label>Mensaje *</Label>
              <Textarea
                value={newTicket.message}
                onChange={(e) => setNewTicket({ ...newTicket, message: e.target.value })}
                placeholder="Describe tu problema en detalle..."
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
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle>{selectedTicket?.subject}</DialogTitle>
                <p className="text-sm text-slate-500 font-mono mt-1">{selectedTicket?.ticket_number}</p>
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