import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
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
import SupportImageUploader from '@/components/support/SupportImageUploader';
import { uploadSupportImages } from '@/components/support/supportUploadUtils';
import ClientPageHero from '@/components/client-portal/ClientPageHero';
import PortalMetricCard from '@/components/client-portal/PortalMetricCard';
import ClientSectionHeader from '@/components/client-portal/ClientSectionHeader';

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
    related_tracking: '',
    attachments: []
  });
  const [creating, setCreating] = useState(false);

  // Requiere autenticación para usar Soporte
  if (!user) {
    return (
      <div className="max-w-xl mx-auto">
        <Card className="border-border/70 bg-card/95 shadow-card">
          <CardHeader>
            <CardTitle>Inicia sesión para usar Soporte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-slate-600">Necesitas una cuenta para crear y ver tus tickets.</p>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => base44.auth.redirectToLogin()}>
              Iniciar sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  useEffect(() => {
    if (user?.email) {
      loadTickets();
    }
  }, [user?.email]);

  const loadTickets = async () => {
    if (!user?.email) return;
    const allTickets = await base44.entities.SupportTicket.filter({ client_email: user.email }, '-created_date');
    setTickets(allTickets);
    setLoading(false);
  };

  const handleCreateTicket = async () => {
    if (!user?.email) { base44.auth.redirectToLogin(); return; }
    if (!newTicket.subject.trim() || !newTicket.message.trim()) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    setCreating(true);
    
    try {
      const ticketNumber = `TKT-${Date.now()}`;
      const uploadedAttachments = await uploadSupportImages(newTicket.attachments);
      const firstMessage = {
        sender_email: user.email,
        sender_name: user.full_name || user.email,
        message: newTicket.message,
        timestamp: new Date().toISOString(),
        is_admin: false,
        attachments: uploadedAttachments
      };

      const ticketData = {
        ticket_number: ticketNumber,
        client_email: user.email,
        subject: newTicket.subject,
        category: newTicket.category,
        priority: newTicket.priority,
        status: 'abierto',
        messages: [firstMessage]
      };

      // Only add related_tracking if it has a value
      if (newTicket.related_tracking && newTicket.related_tracking.trim()) {
        ticketData.related_tracking = newTicket.related_tracking.trim();
      }

      await base44.entities.SupportTicket.create(ticketData);

      // Notify admins
      import('@/components/NotificationUtils').then(({ notifyAdmins }) => {
        notifyAdmins({
          subject: '🎫 Nuevo Ticket de Soporte',
          body: `Un nuevo ticket de soporte ha sido creado:\n\nTicket: ${ticketNumber}\nAsunto: ${newTicket.subject}\nCategoría: ${newTicket.category}\nPrioridad: ${newTicket.priority}\nCliente: ${user.full_name || user.email}\n${newTicket.related_tracking ? `Tracking: ${newTicket.related_tracking}\n` : ''}\nMensaje:\n${newTicket.message}`,
          message: `${user.full_name || user.email} creó un ticket: ${newTicket.subject}`,
          type: 'general',
          icon: 'alert',
          referenceId: ticketNumber
        });
      });

      // Notify client (non-blocking)
      base44.entities.Notification.create({
        user_email: user.email,
        title: '✅ Ticket Creado',
        message: `Tu ticket "${newTicket.subject}" ha sido creado exitosamente.`,
        type: 'general',
        icon: 'check',
        reference_id: ticketNumber
      }).catch(err => console.error('Error notificando cliente:', err));

      toast.success('Ticket creado exitosamente. Te responderemos pronto.');
      setShowNewTicket(false);
      setNewTicket({ subject: '', category: 'otro', priority: 'media', message: '', related_tracking: '', attachments: [] });
      loadTickets();
    } catch (error) {
      console.error('Error al crear ticket:', error);
      toast.error(`Error: ${error.message || 'No se pudo crear el ticket'}`);
    } finally {
      setCreating(false);
    }
  };

  const handleSendMessage = async (message, files = []) => {
    if (!user?.email) { base44.auth.redirectToLogin(); return; }
    const uploadedAttachments = await uploadSupportImages(files);
    const newMessage = {
      sender_email: user.email,
      sender_name: user.full_name || user.email,
      message,
      timestamp: new Date().toISOString(),
      is_admin: false,
      attachments: uploadedAttachments
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

  const supportStats = useMemo(() => ({
    total: tickets.length,
    abiertos: tickets.filter((ticket) => ticket.status === 'abierto').length,
    enProceso: tickets.filter((ticket) => ticket.status === 'en_proceso').length,
    resueltos: tickets.filter((ticket) => ticket.status === 'resuelto').length,
  }), [tickets]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <ClientPageHero
        icon={MessageSquare}
        eyebrow="Finanzas y ayuda"
        title="Soporte"
        description="Gestiona tus tickets y conversa con el equipo desde una vista más clara y premium."
        badges={[`${tickets.length} tickets`, supportStats.abiertos > 0 ? 'Hay casos abiertos' : 'Sin casos abiertos']}
        action={
          <Button onClick={() => setShowNewTicket(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Ticket
          </Button>
        }
        aside={
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Atención rápida</p>
            <div className="rounded-2xl bg-slate-100/90 px-3 py-2 text-sm font-semibold text-slate-700">
              {supportStats.abiertos + supportStats.enProceso} caso(s) activos
            </div>
            <p className="text-sm text-muted-foreground">Incluye tracking y detalle del problema para acelerar la respuesta.</p>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PortalMetricCard title="Total" value={supportStats.total} subtitle="Tickets registrados" icon={MessageSquare} tone="blue" />
        <PortalMetricCard title="Abiertos" value={supportStats.abiertos} subtitle="Esperando atención" icon={AlertCircle} tone="amber" />
        <PortalMetricCard title="En proceso" value={supportStats.enProceso} subtitle="En seguimiento" icon={Clock} tone="violet" />
        <PortalMetricCard title="Resueltos" value={supportStats.resueltos} subtitle="Casos completados" icon={CheckCircle2} tone="blue" />
      </div>

      {/* Tickets List */}
      {tickets.length === 0 ? (
        <Card className="border-border/70 bg-card/95 shadow-card">
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
        <>
          <ClientSectionHeader
            title="Tus tickets"
            description="Abre cualquier ticket para revisar mensajes, estado y seguimiento de tu caso."
          />
          <div className="grid gap-4">
          {tickets.map((ticket) => {
            const statusInfo = statusConfig[ticket.status];
            const StatusIcon = statusInfo.icon;
            const priorityInfo = priorityConfig[ticket.priority];

            return (
              <Card 
                key={ticket.id} 
                className="border border-border/70 bg-card/95 shadow-card hover:shadow-premium transition-all duration-200 cursor-pointer"
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
        </>
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
              <Label>Mensaje *</Label>
              <Textarea
                value={newTicket.message}
                onChange={(e) => setNewTicket({ ...newTicket, message: e.target.value })}
                placeholder="Describe tu problema en detalle..."
                rows={5}
              />
            </div>

            <div className="space-y-2">
              <Label>Fotos (opcional)</Label>
              <SupportImageUploader
                files={newTicket.attachments}
                onChange={(attachments) => setNewTicket({ ...newTicket, attachments })}
                disabled={creating}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTicket(false)} disabled={creating}>Cancelar</Button>
            <Button onClick={handleCreateTicket} className="bg-blue-600 hover:bg-blue-700" disabled={creating}>
              {creating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creando...</> : 'Crear Ticket'}
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
                {selectedTicket?.related_tracking && (
                  <div className="mt-3 inline-flex items-center rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">
                    Tracking relacionado: {selectedTicket.related_tracking}
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