import React from 'react';
import { Copy, Sparkles, Footprints, TriangleAlert, MessageSquareQuote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text || '');
    toast.success('Respuesta copiada');
  } catch {
    toast.error('No se pudo copiar. Selecciona el texto y cópialo manualmente.');
  }
};

// Una intervención del asistente: qué está pasando, el paso a seguir y la
// respuesta lista para copiar y enviar por WhatsApp.
export default function AssistantTurnCard({ answer, onEscalate }) {
  return (
    <div className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Qué está pasando</p>
          <p className="text-sm text-foreground">{answer.diagnostico}</p>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-3">
        <Footprints className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Paso a seguir</p>
          <p className="text-sm font-medium text-foreground">{answer.paso_a_seguir}</p>
        </div>
      </div>

      <div className="space-y-2 rounded-2xl bg-muted/60 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <MessageSquareQuote className="h-3.5 w-3.5" /> Respuesta sugerida
          </p>
          <Button size="sm" variant="outline" onClick={() => copyText(answer.respuesta_sugerida)}>
            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar
          </Button>
        </div>
        <p className="whitespace-pre-wrap text-sm text-foreground">{answer.respuesta_sugerida}</p>
      </div>

      {Array.isArray(answer.datos_clave) && answer.datos_clave.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {answer.datos_clave.map((dato, index) => (
            <Badge key={`${dato}-${index}`} variant="outline" className="font-normal">{dato}</Badge>
          ))}
        </div>
      ) : null}

      {answer.escalar ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-destructive/40 bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm text-foreground">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span><strong>Conviene escalar:</strong> {answer.motivo_escalamiento || 'el caso requiere supervisión'}</span>
          </p>
          <Button size="sm" variant="destructive" onClick={onEscalate}>Escalar a supervisor</Button>
        </div>
      ) : null}
    </div>
  );
}