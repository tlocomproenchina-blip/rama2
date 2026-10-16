import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import SupportAttachmentsPreview from '@/components/support/SupportAttachmentsPreview';

const fdate = (value) => (value
  ? new Date(value).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '');

// Respuestas que Supervisión dejó para este caso: son internas, las ve el ATC y
// nunca se le envían al cliente. Desde aquí se cargan en el asistente para que
// indique cómo continuar el caso y qué responderle al cliente.
export default function AssistantCaseSupervisorReplies({ ticket, client, disabled, onLoadToAssistant }) {
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!ticket?.id) {
      setReplies([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await base44.entities.SupportClientNote.filter(
        { ticket_id: ticket.id, note_type: 'indicacion' },
        '-created_date',
        50,
      );
      setReplies(rows || []);
    } catch {
      setReplies([]);
    } finally {
      setLoading(false);
    }
  }, [ticket?.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <Card className="border-primary/25 bg-primary/5 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" /> Respuesta del supervisor
          {replies.length > 0 ? <Badge variant="secondary" className="ml-1">{replies.length}</Badge> : null}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Interna para el ATC: el cliente no la ve. Cárgala en el asistente de respuestas y él te dirá cómo continuar el caso.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando la respuesta del supervisor…
          </p>
        ) : replies.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-3 text-xs text-muted-foreground">
            Supervisión todavía no ha respondido este caso.
          </p>
        ) : (
          replies.map((reply) => (
            <div key={reply.id} className="rounded-2xl border border-border/70 bg-card p-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{reply.author_name || reply.author_email || 'Supervisión'}</span>
                <span>·</span>
                <span>{fdate(reply.created_date)}</span>
                {reply.addressed_to ? <Badge variant="outline" className="text-[10px]">Para: {reply.addressed_to}</Badge> : null}
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">{reply.note}</p>
              <SupportAttachmentsPreview attachments={reply.attachments} />
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={disabled}
                  onClick={() => onLoadToAssistant({ ticket, client, text: reply.note || '' })}
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Cargar en el asistente
                </Button>
                {disabled ? <span className="text-[11px] text-muted-foreground">Cargando los datos del cliente…</span> : null}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}