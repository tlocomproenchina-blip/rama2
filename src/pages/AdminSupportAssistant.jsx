import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Headphones, MessageCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

// Panel único del área de Soporte, con dos pestañas:
//   Asistente ATC -> busca al cliente y atiende con su expediente completo.
//   Supervisor    -> los casos que el ATC escaló, con todo el expediente para
//                    responder sin salir a buscar información a otras secciones.
export default function AdminSupportAssistant({ user }) {
  const assistant = useSupportAssistant();
  const { cases } = useSupportClientCases(assistant.client?.email);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalated, setEscalated] = useState(null);
  const focusTicketId = new URLSearchParams(window.location.search).get('ticketId') || '';
  const [tab, setTab] = useState(focusTicketId ? 'supervisor' : 'atc');

  const lastTurn = assistant.turns[assistant.turns.length - 1] || null;
  const client = assistant.client;
  const clientName = client?.full_name || [client?.first_name, client?.last_name].filter(Boolean).join(' ') || client?.email || '';

  const handleEscalate = async (payload) => {
    const result = await assistant.escalate({
      ...payload,
      related_tracking: assistant.context?.paquetes?.[0]?.tracking,
    });
    if (result) setEscalated(result);
    return result;
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 px-3 pb-16 pt-4 sm:px-5">
      <PageHero
        icon={Headphones}
        badge="Área Soporte"
        title="Asistente ATC y panel del supervisor"
        description="El ATC busca al cliente y atiende con su expediente completo; cuando escala un caso, el supervisor lo recibe con el chat previo, los adjuntos y todo el historial del cliente en una sola pantalla."
        actions={
          <Button asChild variant="outline">
            <Link to="/AdminSupportTickets">
              <MessageCircle className="mr-1.5 h-4 w-4" /> Ver tickets de soporte
            </Link>
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <TabsList>
          <TabsTrigger value="atc">
            <Headphones className="mr-2 h-4 w-4" />
            Asistente ATC
          </TabsTrigger>
          <TabsTrigger value="supervisor">
            <ShieldCheck className="mr-2 h-4 w-4" />
            Supervisor
          </TabsTrigger>
        </TabsList>

        <TabsContent value="atc" className="mt-0">
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
                    <Button size="sm" onClick={() => setTab('supervisor')}>
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
        </TabsContent>

        <TabsContent value="supervisor" className="mt-0">
          <SupervisorEscalationsPanel user={user} initialTicketId={focusTicketId} />
        </TabsContent>
      </Tabs>

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