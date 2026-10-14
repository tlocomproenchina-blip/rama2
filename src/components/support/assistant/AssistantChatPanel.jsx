import React, { useState } from 'react';
import { Loader2, SendHorizontal, Headphones, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AssistantTurnCard from '@/components/support/assistant/AssistantTurnCard';
import AssistantQuickPrompts from '@/components/support/assistant/AssistantQuickPrompts';

// Chat guiado: el ATC pega lo que el cliente escribió por WhatsApp y el
// asistente responde con el paso a paso y la respuesta lista para enviar.
export default function AssistantChatPanel({ client, turns, asking, onAsk, onEscalate }) {
  const [question, setQuestion] = useState('');

  const send = () => {
    if (!question.trim() || asking) return;
    onAsk(question);
    setQuestion('');
  };

  const disabled = !client || asking;

  return (
    <Card className="flex h-full flex-col border-border/70 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Headphones className="h-4 w-4 text-primary" /> Asistente de respuestas
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {client
            ? `Guiando la atención de ${client.full_name || client.email}. Pega el mensaje del cliente y avanza paso a paso.`
            : 'Elige primero al cliente para que el asistente use su historial real.'}
        </p>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          {turns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Cómo usarlo</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>Busca al cliente por su teléfono o Shipping Mark y ábrelo.</li>
                <li>Copia la pregunta que llegó por WhatsApp y pégala abajo.</li>
                <li>Si el asistente pide verificar la carga, sigue los pasos, copia el mensaje y mándalo al almacén por WhatsApp.</li>
                <li>Pega aquí la respuesta del almacén para continuar con el caso y responderle al cliente.</li>
                <li>Si el caso necesita supervisión, escálalo a un supervisor en un clic.</li>
              </ol>
            </div>
          ) : null}

          {turns.map((turn, index) => (
            <div key={`${turn.at}-${index}`} className="space-y-2">
              <div className="flex justify-end">
                <div className="max-w-[90%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                  <p className="text-[11px] uppercase tracking-[0.12em] opacity-80">Pegado por el ATC · {index + 1}</p>
                  <p className="whitespace-pre-wrap">{turn.question}</p>
                </div>
              </div>
              <AssistantTurnCard answer={turn.answer} onEscalate={onEscalate} />
            </div>
          ))}

          {asking ? (
            <p className="flex items-center gap-2 rounded-2xl bg-muted/60 px-3.5 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Revisando el historial del cliente…
            </p>
          ) : null}
        </div>

        <div className="space-y-3 border-t border-border/70 pt-4">
          <AssistantQuickPrompts onPick={setQuestion} />
          <Textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            rows={3}
            disabled={!client}
            placeholder={client ? 'Pega aquí el mensaje del cliente o la respuesta del almacén…' : 'Primero selecciona al cliente'}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">Enter para analizar · Shift + Enter para salto de línea</p>
            <div className="flex gap-2">
              {turns.length > 0 ? (
                <Button variant="outline" onClick={onEscalate} disabled={!client}>
                  <ArrowUpRight className="mr-1.5 h-4 w-4" /> Escalar caso
                </Button>
              ) : null}
              <Button onClick={send} disabled={disabled || !question.trim()}>
                {asking ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <SendHorizontal className="mr-1.5 h-4 w-4" />}
                {asking ? 'Analizando…' : 'Analizar mensaje'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}