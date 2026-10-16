import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft, CheckCircle2, ClipboardList, ExternalLink, MessageSquare, RotateCcw, History } from 'lucide-react';
import { toast } from 'sonner';
import TicketChat from '@/components/support/TicketChat';
import SupportCaseSummary from '@/components/support/SupportCaseSummary';
import SupportNotesPanel from '@/components/support/client-file/SupportNotesPanel';
import SupportGuidancePanel from '@/components/support/client-file/SupportGuidancePanel';
import SupportClientProfileCard from '@/components/support/client-file/SupportClientProfileCard';
import ClientSupport360 from '@/components/support/client360/ClientSupport360';
import SupervisorCaseAttachments from './SupervisorCaseAttachments';
import PackageEditReviewPanel from './PackageEditReviewPanel';

const PRIORITY = {
  baja: 'bg-slate-100 text-slate-600',
  media: 'bg-blue-100 text-blue-600',
  alta: 'bg-orange-100 text-orange-600',
  urgente: 'bg-red-100 text-red-600',
};

const STATUS_OPTIONS = [
  { value: 'abierto', label: 'Abierto' },
  { value: 'en_proceso', label: 'En Proceso' },
  { value: 'resuelto', label: 'Resuelto' },
  { value: 'cerrado', label: 'Cerrado' },
];

const fdate = (value) => (value
  ? new Date(value).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '');

// Expediente completo de un caso escalado: la conversación previa, los adjuntos,
// los datos del cliente y todo su historial, en una sola pantalla para que el
// supervisor responda sin salir a buscar información a otras secciones.
export default function SupervisorCaseFile({ ticket, user, onBack, onChange }) {
  const [client, setClient] = useState(null);
  const [loadingClient, setLoadingClient] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setClient(null);
    if (!ticket?.client_email) {
      setLoadingClient(false);
      return undefined;
    }
    let active = true;
    setLoadingClient(true);
    base44.functions.invoke('listClientsForSupport', { q: ticket.client_email, limit: 5, includeCounts: false })
      .then((res) => {
        if (!active) return;
        const list = res?.data?.data || [];
        setClient(list.find((item) => (item.email || '').toLowerCase() === ticket.client_email.toLowerCase()) || null);
      })
      .catch(() => {})
      .finally(() => { if (active) setLoadingClient(false); });
    return () => { active = false; };
  }, [ticket?.id, ticket?.client_email]);

  if (!ticket) return null;

  const clientName = client?.full_name
    || [client?.first_name, client?.last_name].filter(Boolean).join(' ')
    || ticket.client_email;
  const pending = (ticket.escalation_status || 'pendiente') === 'pendiente';

  // Toda respuesta de Supervisión es interna: queda en el expediente para el ATC
  // y es lo que hace que el caso aparezca en su bandeja de casos respondidos.
  const handleSupervisorReplySaved = async ({ ticketId } = {}) => {
    if (ticketId !== ticket.id) return;
    const updates = {
      supervisor_reply_date: new Date().toISOString(),
      supervisor_reply_by: user?.email || '',
      supervisor_reply_by_name: user?.full_name || user?.email || 'Supervisión',
      atc_review_status: 'pendiente',
      atc_review_date: null,
      atc_review_by_name: null,
    };
    try {
      await base44.entities.SupportTicket.update(ticket.id, updates);
      onChange({ ...ticket, ...updates });
      if (ticket.escalated_by) {
        base44.entities.Notification.create({
          user_email: ticket.escalated_by,
          title: '🛡️ Respuesta del supervisor',
          message: `Supervisión respondió el caso ${ticket.ticket_number}. Revísalo en el Asistente ATC.`,
          type: 'general',
          icon: 'alert',
          reference_id: ticket.id,
        }).catch(() => {});
      }
    } catch {
      // Si el aviso al ATC no sale, se vuelve a intentar en la próxima respuesta.
    }
  };

  const handleTicketStatus = async (status) => {
    setSaving(true);
    try {
      const updates = { status };
      if (status === 'resuelto' || status === 'cerrado') updates.resolved_date = new Date().toISOString();
      await base44.entities.SupportTicket.update(ticket.id, updates);
      onChange({ ...ticket, ...updates });
      toast.success('Estado del ticket actualizado');
    } catch {
      toast.error('No se pudo actualizar el estado del ticket');
    }
    setSaving(false);
  };

  const handleEscalationStatus = async (nextStatus) => {
    setSaving(true);
    try {
      const updates = nextStatus === 'atendida'
        ? {
          escalation_status: 'atendida',
          escalation_attended_date: new Date().toISOString(),
          escalation_attended_by: user?.email,
          escalation_attended_by_name: user?.full_name || user?.email,
        }
        : { escalation_status: 'pendiente', escalation_attended_date: null, escalation_attended_by: null, escalation_attended_by_name: null };
      await base44.entities.SupportTicket.update(ticket.id, updates);
      onChange({ ...ticket, ...updates });
      toast.success(nextStatus === 'atendida' ? 'Escalación marcada como atendida' : 'Caso devuelto a pendientes');
    } catch {
      toast.error('No se pudo actualizar la escalación');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      <Card className="border-border/70 shadow-card">
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={onBack} aria-label="Volver a la lista">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <span className="font-mono text-xs text-muted-foreground">{ticket.ticket_number}</span>
                <Badge className={PRIORITY[ticket.priority] || PRIORITY.media}>{ticket.priority || 'media'}</Badge>
                <Badge className={pending ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}>
                  {pending ? 'Escalación pendiente' : 'Escalación atendida'}
                </Badge>
              </div>
              <h2 className="mt-1.5 text-lg font-semibold text-foreground">{ticket.subject}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Escalado por {ticket.escalated_by_name || ticket.escalated_by || 'el ATC'} · {fdate(ticket.escalated_date || ticket.created_date)}
                {ticket.assigned_to ? ` · Supervisor: ${ticket.assigned_to}` : ''}
                {!pending && ticket.escalation_attended_by_name
                  ? ` · Atendida por ${ticket.escalation_attended_by_name} · ${fdate(ticket.escalation_attended_date)}`
                  : ''}
              </p>
              {ticket.related_tracking ? (
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <span className="text-[11px] text-muted-foreground">Tracking:</span>
                  {ticket.related_tracking.split(',').map((tracking, index) => (
                    <Badge key={`${tracking}-${index}`} variant="outline" className="font-mono text-[11px]">{tracking.trim()}</Badge>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to={`/AdminSupportTickets?ticketId=${ticket.id}`}>
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Abrir en Tickets
                </Link>
              </Button>
              {pending ? (
                <Button size="sm" onClick={() => handleEscalationStatus('atendida')} disabled={saving}>
                  {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                  Marcar como atendida
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => handleEscalationStatus('pendiente')} disabled={saving}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reabrir escalación
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {ticket.escalation_summary ? (
        <Card className="border-primary/25 bg-primary/5 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-primary" /> Resumen que dejó el ATC
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SupportCaseSummary text={ticket.escalation_summary} />
          </CardContent>
        </Card>
      ) : null}

      <PackageEditReviewPanel clientEmail={ticket.client_email} user={user} />

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="space-y-5">
          <SupportGuidancePanel
            clientEmail={ticket.client_email}
            clientName={clientName}
            clientCedula={client?.cedula || ''}
            cases={[{ id: ticket.id, ticket_number: ticket.ticket_number, subject: ticket.subject }]}
            defaultCaseId={ticket.id}
            user={user}
            onSaved={handleSupervisorReplySaved}
            title="Respuesta al ATC"
            description="Tu respuesta va al ATC, no al cliente: queda en el expediente de este caso y le aparece en su bandeja del Asistente ATC para que él continúe la atención. El cliente nunca la ve."
          />

          <Card className="border-border/70 shadow-card">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MessageSquare className="h-4 w-4 text-primary" /> Conversación con el cliente (historial)
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Aquí solo se lee: es la conversación que el cliente tiene con el ATC. Tu respuesta va arriba, en la respuesta al ATC, y el ATC se encarga de comunicársela al cliente.
                  </p>
                </div>
                <Select value={ticket.status} onValueChange={handleTicketStatus} disabled={saving}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <TicketChat
                messages={ticket.messages || []}
                currentUserEmail={user?.email}
                disabled
                scrollClassName="max-h-[30rem] xl:max-h-[34rem]"
              />
            </CardContent>
          </Card>

          <SupervisorCaseAttachments messages={ticket.messages || []} />
        </div>

        <div className="space-y-5">
          {loadingClient ? (
            <Card className="border-border/70 shadow-card">
              <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando los datos del cliente…
              </CardContent>
            </Card>
          ) : (
            <SupportClientProfileCard client={client} />
          )}

          <SupportNotesPanel
            clientEmail={ticket.client_email}
            clientName={clientName}
            clientCedula={client?.cedula || ''}
            ticketId={ticket.id}
            ticketNumber={ticket.ticket_number}
            user={user}
            title="Notas internas del caso"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">Historial completo del cliente</h3>
        </div>
        <ClientSupport360 clientEmail={ticket.client_email} currentTicketId={ticket.id} />
      </div>
    </div>
  );
}