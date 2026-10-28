import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import InternalCaseMessageItem from './InternalCaseMessageItem';
import InternalCaseComposer from './InternalCaseComposer';

// Chat interno del caso: lo ven y lo escriben solo el ATC que escaló el caso y
// Supervisión. Vive aparte del historial del ticket, así que el cliente nunca lo
// recibe y no dispara emails ni notificaciones.
export default function InternalCaseChat({ ticket, user, role = 'supervisor' }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!ticket?.id) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await base44.entities.InternalCaseMessage.filter({ ticket_id: ticket.id }, 'created_date', 200);
      setMessages(rows || []);
    } catch {
      toast.error('No se pudo cargar el chat interno del caso');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [ticket?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!ticket?.id) return undefined;
    const unsubscribe = base44.entities.InternalCaseMessage.subscribe((event) => {
      const data = event?.data;
      if (!data) return;
      if (event.type === 'delete') {
        const id = data.id || data;
        setMessages((prev) => prev.filter((item) => item.id !== id));
        return;
      }
      if (data.ticket_id !== ticket.id) return;
      if (event.type === 'create') {
        setMessages((prev) => (prev.some((item) => item.id === data.id) ? prev : [...prev, data]));
      } else if (event.type === 'update') {
        setMessages((prev) => prev.map((item) => (item.id === data.id ? { ...item, ...data } : item)));
      }
    });
    return unsubscribe;
  }, [ticket?.id]);

  return (
    <Card className="border-indigo-200 bg-indigo-50/40 shadow-none">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4 text-indigo-600" /> Chat interno del caso
            {messages.length > 0 ? <Badge variant="secondary" className="ml-1">{messages.length}</Badge> : null}
          </CardTitle>
          <Badge className="bg-indigo-100 text-indigo-700">Privado · ATC escalador y Supervisión</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Información interna para trabajar el caso. No es parte del chat del cliente: él no la ve, no se le envía por
          email y no genera notificaciones.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando el chat interno…
          </p>
        ) : messages.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-3 text-xs text-muted-foreground">
            Todavía no hay mensajes internos en este caso. Escribe el primero: puedes adjuntar hasta 10 imágenes.
          </p>
        ) : (
          <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-1">
            {messages.map((message) => (
              <InternalCaseMessageItem key={message.id} message={message} currentUserEmail={user?.email} />
            ))}
          </div>
        )}

        <InternalCaseComposer ticket={ticket} user={user} role={role} onSent={load} />
      </CardContent>
    </Card>
  );
}