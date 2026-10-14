import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Headphones, MessageCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHero from '@/components/common/PageHero';
import useSupportAssistant from '@/hooks/useSupportAssistant';
import AssistantSearchPanel from '@/components/support/assistant/AssistantSearchPanel';
import AssistantClientPanel from '@/components/support/assistant/AssistantClientPanel';
import AssistantChatPanel from '@/components/support/assistant/AssistantChatPanel';
import AssistantEscalateDialog from '@/components/support/assistant/AssistantEscalateDialog';

// Sección de preguntas y respuestas del área de Soporte: el ATC busca al
// cliente por teléfono o Shipping Mark, pega la pregunta que llegó por
// WhatsApp y recibe la guía paso a paso con la respuesta lista para enviar.
export default function AdminSupportAssistant() {
  const assistant = useSupportAssistant();
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalated, setEscalated] = useState(null);

  const lastTurn = assistant.turns[assistant.turns.length - 1] || null;

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
        title="Preguntas y respuestas (ATC)"
        description="Busca al cliente por teléfono o Shipping Mark, pega su mensaje de WhatsApp y recibe el paso a paso con la respuesta lista para enviar."
        actions={
          <Button asChild variant="outline">
            <Link to="/AdminSupportTickets">
              <MessageCircle className="mr-1.5 h-4 w-4" /> Ver tickets de soporte
            </Link>
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="space-y-5">
          <AssistantSearchPanel
            query={assistant.query}
            onQueryChange={assistant.setQuery}
            onSearch={assistant.search}
            searching={assistant.searching}
            results={assistant.results}
            client={assistant.client}
            onSelect={assistant.selectClient}
            onClear={assistant.clearClient}
          />
          <AssistantClientPanel
            client={assistant.client}
            context={assistant.context}
            loading={assistant.loadingContext}
          />
        </div>

        <div className="space-y-4">
          {escalated ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Caso escalado: ticket <strong>{escalated.ticket_number}</strong> asignado a {escalated.assigned_to}.
              </p>
              <Button asChild size="sm" variant="outline">
                <Link to="/AdminSupportTickets">Abrir tickets</Link>
              </Button>
            </div>
          ) : null}

          <AssistantChatPanel
            client={assistant.client}
            turns={assistant.turns}
            asking={assistant.asking}
            onAsk={assistant.ask}
            onEscalate={() => setEscalateOpen(true)}
          />
        </div>
      </div>

      <AssistantEscalateDialog
        open={escalateOpen}
        onOpenChange={setEscalateOpen}
        client={assistant.client}
        lastTurn={lastTurn}
        submitting={assistant.escalating}
        onConfirm={handleEscalate}
      />
    </div>
  );
}