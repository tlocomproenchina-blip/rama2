import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useSupportAssistant from '@/hooks/useSupportAssistant';
import useCrmInbox from '@/hooks/useCrmInbox';
import useCrmClientSummary from '@/hooks/useCrmClientSummary';
import AssistantSearchPanel from '@/components/support/assistant/AssistantSearchPanel';
import AssistantEscalateDialog from '@/components/support/assistant/AssistantEscalateDialog';
import CrmKpis from '@/components/support/crm/CrmKpis';
import CrmInbox from '@/components/support/crm/CrmInbox';
import CrmClientHeader from '@/components/support/crm/CrmClientHeader';
import CrmAttendPanel from '@/components/support/crm/CrmAttendPanel';
import CrmClientFile from '@/components/support/crm/CrmClientFile';

// CRM de atención: jornada del agente, bandeja (Agenda y Casos) y expediente del cliente.
export default function AdminSupportCRM({ user }) {
  const assistant = useSupportAssistant();
  const inbox = useCrmInbox();
  const client = assistant.client;
  const { summary, reload: reloadSummary } = useCrmClientSummary(client?.email);
  const [caseId, setCaseId] = useState(null);
  const [opening, setOpening] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);

  const activeCase = (inbox.data?.cases || []).find((c) => c.id === caseId) || null;

  const openByEmail = async (email, ticketId = null) => {
    setOpening(true);
    const res = await base44.functions.invoke('listClientsForSupport', { q: email, limit: 5, includeCounts: false });
    const found = (res?.data?.data || []).find((c) => c.email === email);
    setCaseId(ticketId || null);
    await assistant.selectClient(found || { email, full_name: email });
    setOpening(false);
  };

  const back = () => {
    assistant.clearClient();
    setCaseId(null);
    inbox.reload();
  };

  const handleEscalate = async (payload) => {
    const result = await assistant.escalate({ ...payload, related_tracking: assistant.context?.paquetes?.[0]?.tracking });
    if (result) reloadSummary();
    return result;
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4">
      {!client ? (
        <>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">CRM de atención</h1>
            <p className="text-sm text-muted-foreground">Tu jornada: a quién responder, qué tareas vencen y qué casos siguen abiertos.</p>
          </div>
          <CrmKpis kpis={inbox.data?.kpis} loading={inbox.loading} />
          {opening && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Abriendo cliente…</p>}
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
                onSelect={(c) => { setCaseId(null); assistant.selectClient(c); }}
                onClear={assistant.clearClient}
              />
            </div>
          </div>
        </>
      ) : (
        <>
          <CrmClientHeader client={client} summary={summary} user={user} onBack={back} onTagsSaved={reloadSummary} />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="min-w-0">
              <CrmAttendPanel client={client} activeCase={activeCase} assistant={assistant} onEscalate={() => setEscalateOpen(true)} />
            </div>
            <div className="min-w-0">
              <CrmClientFile client={client} user={user} />
            </div>
          </div>
        </>
      )}

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