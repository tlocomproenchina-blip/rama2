import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { uploadSupportImages } from '@/components/support/supportUploadUtils';
import ClientPageHero from '@/components/client-portal/ClientPageHero';
import PortalMetricCard from '@/components/client-portal/PortalMetricCard';
import ClientSectionHeader from '@/components/client-portal/ClientSectionHeader';
import SupportAssistant from '@/components/support/SupportAssistant';
import NewTicketChat from '@/components/support/NewTicketChat';

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
  const urlParams = new URLSearchParams(window.location.search);
  const ticketIdFromUrl = urlParams.get('ticket');

  useEffect(() => {
    if (user?.email) {
      loadTickets();
    }
  }, [user?.email]);

  const loadTickets = async () => {
    if (!user?.email) return;
    const allTickets = await base44.entities.SupportTicket.filter({ client_email: user.email }, '-created_date');
    setTickets(allTickets);
    if (ticketIdFromUrl) {
      const matchedTicket = allTickets.find(ticket => ticket.id === ticketIdFromUrl);
      if (matchedTicket) {
        setSelectedTicket(matchedTicket);
      }
    }
    setLoading(false);
  };

  const handleSendMessage = async (message, files = []) => {
    if (!user?.email) { base44.auth.redirectToLogin(); return; }
    const uploadedAttachments = await uploadSupportImages(files, getTicketPhotoLimit(selectedTicket));
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

    // Notify ALL admins about client response
    import('@/components/NotificationUtils').then(({ notifyAdmins }) => {
      notifyAdmins({
        subject: '💬 Nuevo mensaje de cliente en ticket',
        body: `El cliente ${user.full_name || user.email} ha respondido en el ticket ${selectedTicket.ticket_number}:\n\nAsunto: ${selectedTicket.subject}\n\nMensaje:\n${message}`,
        message: `${user.full_name || user.email} respondió en ${selectedTicket.ticket_number}`,
        type: 'general',
        icon: 'alert',
        referenceId: selectedTicket.id
      });
    });

    const newStatus = selectedTicket.status === 'resuelto' ? 'abierto' : selectedTicket.status;
    const updatedTicket = { ...selectedTicket, messages: updatedMessages, status: newStatus };
    setSelectedTicket(updatedTicket);
    // Optimistic update local
    setTickets((prev) => prev.map((t) => t.id === selectedTicket.id ? updatedTicket : t));
    return true;
  };

  const getTicketPhotoLimit = (ticket) => {
    const trackingCount = (ticket?.related_tracking || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean).length;

    return Math.max(1, trackingCount || 3);
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

  // Calcular stats en un solo recorrido
  const supportStats = useMemo(() => {
    const stats = { total: tickets.length, abiertos: 0, enProceso: 0, resueltos: 0 };
    for (const t of tickets) {
      if (t.status === 'abierto') stats.abiertos++;
      else if (t.status === 'en_proceso') stats.enProceso++;
      else if (t.status === 'resuelto') stats.resueltos++;
    }
    return stats;
  }, [tickets]);

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

      {/* Asistente de autoatención (sin IA) */}
      <SupportAssistant onOpenTicket={(category) => {
        setNewTicket((prev) => ({ ...prev, category }));
        setShowNewTicket(true);
      }} />

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

      {/* New Ticket Chat Dialog */}
      <Dialog open={showNewTicket} onOpenChange={setShowNewTicket}>
        <DialogContent className="max-w-2xl p-5">
          <NewTicketChat
            user={user}
            onClose={() => setShowNewTicket(false)}
            onCreated={(created) => {
              if (created?.id) {
                setTickets((prev) => [created, ...prev]);
              }
              setShowNewTicket(false);
              setNewTicket({ subject: '', category: 'otro', priority: 'media', message: '', related_tracking: '', attachments: [] });
            }}
            initialCategory={newTicket.category}
          />
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
            maxFiles={getTicketPhotoLimit(selectedTicket)}
            ticketId={selectedTicket?.id}
            feedbackReceived={selectedTicket?.feedback_received}
            onFeedbackSubmitted={(data) => {
              if (data?.action === 'resolved') {
                const updated = { ...selectedTicket, status: 'resuelto', feedback_received: 'positivo' };
                setSelectedTicket(updated);
                setTickets((prev) => prev.map((t) => t.id === selectedTicket.id ? updated : t));
              } else if (data?.action === 're_opened') {
                loadTickets();
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}