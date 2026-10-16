import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, CheckCircle2, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import AssistantCaseSupervisorReplies from '@/components/support/assistant/AssistantCaseSupervisorReplies';
import AssistantCaseClientReply from '@/components/support/assistant/AssistantCaseClientReply';
import AssistantCaseContext from '@/components/support/assistant/AssistantCaseContext';

const PRIORITY = {
  baja: 'bg-slate-100 text-slate-600',
  media: 'bg-blue-100 text-blue-600',
  alta: 'bg-orange-100 text-orange-600',
  urgente: 'bg-red-100 text-red-600',
};

const fdate = (value) => (value
  ? new Date(value).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '');

// Expediente del caso ya respondido por Supervisión: el ATC ve todo el caso,
// carga la respuesta interna en el asistente y le responde al cliente.
export default function SupervisorAnsweredCase({ ticket, user, onBack, onChange, onLoadToAssistant }) {
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

  const pending = (ticket.atc_review_status || 'pendiente') === 'pendiente';

  // Marcar atendido a mano: para cuando el ATC ya le respondió al cliente por
  // WhatsApp o el caso no necesitaba respuesta escrita.
  const handleMarkAttended = async () => {
    setSaving(true);
    try {
      const updates = {
        atc_review_status: 'revisado',
        atc_review_date: new Date().toISOString(),
        atc_review_by_name: user?.full_name || user?.email || '',
      };
      await base44.entities.SupportTicket.update(ticket.id, updates);
      onChange({ ...ticket, ...updates });
      toast.success('Caso marcado como atendido');
    } catch {
      toast.error('No se pudo marcar el caso');
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
                  {pending ? 'Pendiente de revisión' : 'Atendido'}
                </Badge>
              </div>
              <h2 className="mt-1.5 text-lg font-semibold text-foreground">{ticket.subject}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Cliente: {ticket.client_email} · Escalado por {ticket.escalated_by_name || ticket.escalated_by || 'el ATC'} · {fdate(ticket.escalated_date || ticket.created_date)}
                {ticket.supervisor_reply_by_name
                  ? ` · Respondido por ${ticket.supervisor_reply_by_name} · ${fdate(ticket.supervisor_reply_date)}`
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
              {pending ? (
                <Button size="sm" variant="outline" onClick={handleMarkAttended} disabled={saving}>
                  {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                  Marcar atendido
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50/70 shadow-none">
        <CardContent className="flex items-start gap-2 py-3 text-xs text-amber-900">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            La respuesta del supervisor es interna: es una indicación para ti y el cliente nunca la ve.
            Cárgala en el asistente para preparar la respuesta y la continuidad del caso, y envía tú la respuesta al cliente.
          </p>
        </CardContent>
      </Card>

      <AssistantCaseSupervisorReplies
        ticket={ticket}
        client={client}
        disabled={loadingClient}
        onLoadToAssistant={onLoadToAssistant}
      />

      <AssistantCaseClientReply ticket={ticket} user={user} onChange={onChange} />

      <AssistantCaseContext ticket={ticket} client={client} loadingClient={loadingClient} />
    </div>
  );
}