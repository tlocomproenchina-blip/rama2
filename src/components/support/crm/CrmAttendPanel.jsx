import React, { useState } from 'react';
import { Sparkles, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import QuickMessagePicker from '@/components/support/QuickMessagePicker';
import AssistantChatPanel from '@/components/support/assistant/AssistantChatPanel';

// Atender: último mensaje del caso, pasarlo al asistente, respuestas rápidas y escalar.
export default function CrmAttendPanel({ client, activeCase, assistant, onEscalate }) {
  const [prefill, setPrefill] = useState(null);
  const lastClientMsg = activeCase?.last_message && !activeCase.last_message.is_admin ? activeCase.last_message : null;

  const toAssistant = () => setPrefill({
    text: `Mensaje del cliente (caso ${activeCase.ticket_number}):\n\n${lastClientMsg?.message || activeCase.subject}`,
    nonce: Date.now(),
  });

  const copyQuick = async (selected) => {
    await navigator.clipboard.writeText(selected.message || '');
    toast.success('Respuesta rápida copiada');
  };

  return (
    <div className="space-y-4">
      {activeCase && (
        <div className="space-y-2 rounded-xl border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Caso {activeCase.ticket_number} · {activeCase.subject}</p>
          <p className="whitespace-pre-wrap rounded-lg bg-muted/60 p-2.5 text-sm text-foreground">
            {lastClientMsg ? lastClientMsg.message : 'El último mensaje del caso es del equipo.'}
          </p>
          <Button size="sm" onClick={toAssistant}><Sparkles className="h-4 w-4" /> Pasar al asistente</Button>
        </div>
      )}

      <AssistantChatPanel
        client={client}
        turns={assistant.turns}
        asking={assistant.asking}
        prefill={prefill}
        onAsk={(text) => assistant.ask(text)}
        onEscalate={onEscalate}
      />

      <div className="space-y-2 rounded-xl border border-border bg-card p-3">
        <p className="text-xs font-semibold text-muted-foreground">Respuestas rápidas del equipo (se copian)</p>
        <QuickMessagePicker onPick={copyQuick} />
        <Button size="sm" variant="outline" onClick={onEscalate}><ArrowUpRight className="h-4 w-4" /> Escalar a supervisión</Button>
      </div>
    </div>
  );
}