import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useSupportAssistant from '@/hooks/useSupportAssistant';
import useCrmInbox from '@/hooks/useCrmInbox';
import useCrmClientSummary from '@/hooks/useCrmClientSummary';
import useSupportDepartments from '@/hooks/useSupportDepartments';
import AssistantSearchPanel from '@/components/support/assistant/AssistantSearchPanel';
import AssistantEscalateDialog from '@/components/support/assistant/AssistantEscalateDialog';
import AssistantSupervisorCases from '@/components/support/assistant/AssistantSupervisorCases';
import AssistantOrphanPanel from '@/components/support/orphans/AssistantOrphanPanel';
import CrmKpis from '@/components/support/crm/CrmKpis';
import CrmInbox from '@/components/support/crm/CrmInbox';
import CrmClientHeader from '@/components/support/crm/CrmClientHeader';
import CrmAttendPanel from '@/components/support/crm/CrmAttendPanel';
import CrmClientFile from '@/components/support/crm/CrmClientFile';
import CrmCaseConversation from '@/components/support/crm/CrmCaseConversation';
import CrmWorkspaceTabs from '@/components/support/crm/CrmWorkspaceTabs';

const AdminSupportTickets = lazy(() => import('./AdminSupportTickets'));
const TABS = ['bandeja', 'tickets', 'supervision', 'huerfanos'];
const loader = <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</p>;

// Espacio único de Soporte: bandeja del CRM, ficha del caso con conversación y
// asistente ATC, tickets, respuestas de supervisión y paquetes huérfanos.
export default function AdminSupportCRM({ user }) {
  const assistant = useSupportAssistant();
  const inbox = useCrmInbox();
  const deps = useSupportDepartments(user);
  const client = assistant.client;
  const { summary, reload: reloadSummary } = useCrmClientSummary(client?.email);
  const [tab, setTab] = useState(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    return TABS.includes(t) ? t : 'bandeja';
  });
  const [caseId, setCaseId] = useState(null);
  const [opening, setOpening] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [prefill, setPrefill] = useState(null);
  const [askOrigin, setAskOrigin] = useState('atc');

  const activeCase = (inbox.data?.cases || []).find((c) => c.id === caseId) || null;

  const changeTab = (next) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', next);
    url.searchParams.delete('ticketId');
    window.history.replaceState(null, '', url);
  };

  const openByEmail = async (email, ticketId = null, picked = null) => {
    setOpening(true);
    let found = picked;
    if (!found) {
      const res = await base44.functions.invoke('listClientsForSupport', { q: email, limit: 5, includeCounts: false });
      found = (res?.data?.data || []).find((c) => c.email === email);
    }
    setCaseId(ticketId || null);
    setAskOrigin('atc');
    setPrefill(null);
    await assistant.selectClient(found || { email, full_name: email });
    setOpening(false);
  };

  // Enlaces y notificaciones con ?ticketId= abren directamente la ficha del caso.
  useEffect(() => {
    const ticketId = new URLSearchParams(window.location.search).get('ticketId');
    if (!ticketId) return;
    base44.entities.SupportTicket.get(ticketId).then((t) => t && openByEmail(t.client_email, t.id));
  }, []);

  const back = () => {
    assistant.clearClient();
    setCaseId(null);
    setPrefill(null);
    inbox.reload();
  };

  const handleEscalate = async (payload) => {
    const result = await assistant.escalate({ ...payload, related_tracking: assistant.context?.paquetes?.[0]?.tracking });
    if (result) reloadSummary();
    return result;
  };

  // Respuesta interna del supervisor: se abre el caso y se carga en el asistente.
  const loadSupervisorReply = async ({ ticket, client: caseClient, text }) => {
    await openByEmail(ticket.client_email, ticket.id, caseClient);
    setAskOrigin('supervisor');
    setPrefill({
      text: `Respuesta del supervisor · caso ${ticket.ticket_number} (comunicación interna, no va al cliente):\n\n${text}\n\nDame la indicación de continuidad del caso y el mensaje para el cliente.`,
      nonce: Date.now(),
    });
  };

  if (client) {
    return (
      <div className="mx-auto w-full max-w-[1500px] space-y-4">
        <CrmClientHeader client={client} summary={summary} user={user} onBack={back} onTagsSaved={reloadSummary} />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="min-w-0 space-y-4">
            {caseId && <CrmCaseConversation ticketId={caseId} user={user} deps={deps} onMove={(id, dep) => inbox.moveCase(id, dep, user)} />}
            <CrmAttendPanel client={client} activeCase={activeCase} assistant={assistant} onEscalate={() => setEscalateOpen(true)} externalPrefill={prefill} askOrigin={askOrigin} />
          </div>
          <div className="min-w-0">
            <CrmClientFile client={client} user={user} />
          </div>
        </div>
        <AssistantEscalateDialog
          open={escalateOpen}
          onOpenChange={setEscalateOpen}
          client={client}
          lastTurn={assistant.turns[assistant.turns.length - 1] || null}
          submitting={assistant.escalating}
          onConfirm={handleEscalate}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">CRM de atención</h1>
        <p className="text-sm text-muted-foreground">Todo Soporte en un solo lugar: casos, tickets, asistente ATC y respuestas de supervisión.</p>
      </div>
      <CrmWorkspaceTabs value={tab} onChange={changeTab} />
      {opening && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Abriendo cliente…</p>}

      {tab === 'bandeja' && (
        <>
          <CrmKpis kpis={inbox.data?.kpis} loading={inbox.loading} />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="order-2 min-w-0 lg:order-1">
              <CrmInbox inbox={inbox} onOpen={openByEmail} user={user} />
            </div>
            <div className="order-1 lg:order-2">
              <AssistantSearchPanel
                query={assistant.query}
                onQueryChange={assistant.setQuery}
                onSearch={assistant.search}
                searching={assistant.searching}
                results={assistant.results}
                client={client}
                onSelect={(c) => { setCaseId(null); setPrefill(null); assistant.selectClient(c); }}
                onClear={assistant.clearClient}
              />
            </div>
          </div>
        </>
      )}
      {tab === 'tickets' && <Suspense fallback={loader}><AdminSupportTickets user={user} embedded onOpenCase={(t) => openByEmail(t.client_email, t.id)} /></Suspense>}
      {tab === 'supervision' && <AssistantSupervisorCases user={user} onLoadToAssistant={loadSupervisorReply} />}
      {tab === 'huerfanos' && <AssistantOrphanPanel />}
    </div>
  );
}