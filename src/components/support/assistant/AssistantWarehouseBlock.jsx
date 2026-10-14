import React from 'react';
import { Warehouse, Copy, ClipboardList, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// Cuando la consulta obliga a confirmar que una carga sigue físicamente en
// almacén: los pasos para ubicarla por cliente y el mensaje listo para copiar
// y enviar al almacén por WhatsApp.
export default function AssistantWarehouseBlock({ pasos, mensaje }) {
  const steps = Array.isArray(pasos) ? pasos.filter(Boolean) : [];
  const text = String(mensaje || '').trim();
  if (steps.length === 0 && !text) return null;

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Mensaje copiado. Envíalo al almacén por WhatsApp');
    } catch {
      toast.error('No se pudo copiar. Selecciona el texto y cópialo manualmente.');
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
          <Warehouse className="h-3.5 w-3.5" /> Verificación con almacén
        </p>
        <Badge variant="outline" className="border-amber-300 bg-white/80 font-normal text-amber-800">
          Antes de responder
        </Badge>
      </div>

      {steps.length > 0 ? (
        <div className="flex items-start gap-2">
          <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <ol className="list-decimal space-y-1.5 pl-4 text-sm text-foreground">
            {steps.map((step, index) => (
              <li key={`${step}-${index}`}>{step}</li>
            ))}
          </ol>
        </div>
      ) : null}

      {text ? (
        <div className="space-y-2 rounded-2xl border border-amber-200 bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <MessageCircle className="h-3.5 w-3.5" /> Mensaje para el almacén · WhatsApp
            </p>
            <Button size="sm" variant="outline" onClick={copyMessage}>
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar
            </Button>
          </div>
          <p className="whitespace-pre-wrap text-sm text-foreground">{text}</p>
          <p className="text-xs text-muted-foreground">
            Mándalo por WhatsApp y pega aquí la respuesta del almacén para seguir con el caso.
          </p>
        </div>
      ) : null}
    </div>
  );
}