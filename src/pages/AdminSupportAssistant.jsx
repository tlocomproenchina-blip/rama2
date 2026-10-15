import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Headphones, MessageCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHero from '@/components/common/PageHero';
import useSupportAssistant from '@/hooks/useSupportAssistant';
import useSupportClientCases from '@/hooks/useSupportClientCases';
import AssistantSearchPanel from '@/components/support/assistant/AssistantSearchPanel';
import AssistantClientPanel from '@/components/support/assistant/AssistantClientPanel';
import AssistantChatPanel from '@/components/support/assistant/AssistantChatPanel';
import AssistantEscalateDialog from '@/components/support/assistant/AssistantEscalateDialog';
import SupportClientProfileCard from '@/components/support/client-file/SupportClientProfileCard';
import SupportNotesPanel from '@/components/support/client-file/SupportNotesPanel';
import SupportGuidancePanel from '@/components/support/client-file/SupportGuidancePanel';
import SupportFollowUpPanel from '@/components/support/client-file/SupportFollowUpPanel';
import SupervisorEscalationsPanel from '@/components/support/supervisor/SupervisorEscalationsPanel';

// Panel único del área de Soporte, con dos módulos independientes apilados:
//   Asistente ATC -> busca al cliente y atiende con su expediente completo.
//   Supervisor    -> los casos que el ATC escaló, con todo el expediente para
//                    responder sin salir a buscar información a otras secciones.
export default function AdminSupportAssistant({ user }) {
  const assistant = useSupportAssistant();
  const { cases } = useSupportClientCases(assistant.client?.email);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalated, setEscalated] = useState(null);
  const supervisorRef = useRef(null);
  const focusTicketId = new URLSearchParams(window.location.search).get('ticketId') || '';

  const lastTurn = assistant.turns[assistant.turns.length - 1] || null;
  const client = assistant.client;
  const clientName = client?.full_name || [client?.first_name, client?.last_name].filter(Boolean).join(' ') || client?.email || '';

  const goToSupervisor = () => {
    supervisorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Llegada desde la notificación: ?ticketId=... baja directo al caso escalado.
  useEffect(() => {
    if (!focusTicketId) return undefined;
    const timer = setTimeout(goToSupervisor, 300);
    return () => clearTimeout(timer);
  }, [focusTicketId]);

  const handleEscalate = async (payload) => {
    const result = await assistant.escalate({
      ...payload,
      related_tracking: assistant.context?.paquetes?.[0]?.tracking,
    });
    if (result) setEscalated(result);
    return result;
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-8 px-3 pb-16 pt-4 sm:px-5">
      <PageHero
        icon={Headphones}
        badge="Área Soporte"
        title="Asistente ATC y módulo del supervisor"
        description="El ATC busca al cliente y atiende con su expediente completo; cuando escala un caso, el supervisor lo recibe abajo con el chat previo, los adjuntos y todo el historial del cliente en una sola pantalla."
        actions={
          <Button asChild variant="outline">
            <Link to="/AdminSupportTickets">
              <MessageCircle className="mr-1.5 h-4 w-4" /> Ver tickets de soporte
            </Link>
          </Button>
        }
      />

      <section className="space-y-5 rounded-3xl border border-border/70 bg-card/40 p-3 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Headphones className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Asistente ATC</h2>
            <p className="text-xs text-muted-foreground">
              Busca al cliente, revisa su expediente y atiende la conversación. Si el caso necesita a un supervisor, escálalo desde aquí.
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <div className="space-y-5">
            <AssistantSearchPanel
              query={assistant.query}
              onQueryChange={assistant.setQuery}
              onSearch={assistant.search}
              searching={assistant.searching}
              results={assistant.results}
              client={client}
              onSelect={assistant.selectClient}
              onClear={assistant.clearClient}
            />

            {client ? <SupportClientProfileCard client={client} /> : null}

            <AssistantClientPanel
              client={client}
              context={assistant.context}
              loading={assistant.loadingContext}
            />
          </div>

          <div className="space-y-5">
            {escalated ? (
              <div className="flex flex-col gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Caso escalado: ticket <strong>{escalated.ticket_number}</strong> asignado a {escalated.assigned_to}.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={goToSupervisor}>
                    <ShieldCheck className="mr-1.5 h-4 w-4" /> Ver en Supervisor
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/AdminSupportTickets">Abrir tickets</Link>
                  </Button>
                </div>
              </div>
            ) : null}

            <AssistantChatPanel
              client={client}
              turns={assistant.turns}
              asking={assistant.asking}
              onAsk={assistant.ask}
              onEscalate={() => setEscalateOpen(true)}
            />

            {client ? (
              <>
                <div className="grid gap-5 xl:grid-cols-2">
                  <SupportNotesPanel
                    clientEmail={client.email}
                    clientName={clientName}
                    clientCedula={client.cedula}
                    user={user}
                    title="Notas internas del cliente"
                  />
                  <SupportGuidancePanel
                    clientEmail={client.email}
                    clientName={clientName}
                    clientCedula={client.cedula}
                    cases={cases}
                    user={user}
                  />
                </div>

                <SupportFollowUpPanel
                  clientEmail={client.email}
                  clientName={clientName}
                  clientCedula={client.cedula}
                  shippingMark={client.shipping_mark}
                  cases={cases}
                  user={user}
                />
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                Busca y abre un cliente para ver su expediente: datos de contacto, historial, notas internas, indicaciones del supervisor y seguimiento de casos.
              </div>
            )}
          </div>
        </div>
      </section>

      <section ref={supervisorRef} className="scroll-mt-24 space-y-5 rounded-3xl border border-border/70 bg-card/40 p-3 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Supervisor</h2>
            <p className="text-xs text-muted-foreground">
              Casos que el ATC escaló, pendientes primero. Ábrelos para responder en el chat del caso, dejar notas internas y ver todo el historial del cliente.
            </p>
          </div>
        </div>

        <SupervisorEscalationsPanel user={user} initialTicketId={focusTicketId} />
      </section>

      <AssistantEscalateDialog
        open={escalateOpen}
        onOpenChange={setEscalateOpen}
        client={client}
        lastTurn={lastTurn}
        submitting={assistant.escalating}
        onConfirm={handleEscalate}
      />
    </div>
  );
}