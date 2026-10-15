import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare } from 'lucide-react';

const STATUS = {
  abierto: { label: 'Abierto', className: 'bg-blue-100 text-blue-700' },
  en_proceso: { label: 'En proceso', className: 'bg-yellow-100 text-yellow-700' },
  resuelto: { label: 'Resuelto', className: 'bg-green-100 text-green-700' },
  cerrado: { label: 'Cerrado', className: 'bg-slate-100 text-slate-600' },
};

const PRIORITY = {
  baja: { label: 'Baja', className: 'bg-slate-100 text-slate-600' },
  media: { label: 'Media', className: 'bg-blue-100 text-blue-600' },
  alta: { label: 'Alta', className: 'bg-orange-100 text-orange-600' },
  urgente: { label: 'Urgente', className: 'bg-red-100 text-red-600' },
};

const fdate = (value) => (value ? new Date(value).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

// Casos de soporte del cliente, completos (abiertos y pasados), con su estado,
// prioridad, responsable y último mensaje: es el expediente de atención del cliente.
export default function SupportClientCasesCard({ clientEmail }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientEmail) {
      setTickets([]);
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    base44.entities.SupportTicket.filter({ client_email: clientEmail }, '-created_date', 50)
      .then((rows) => {
        if (active) setTickets(rows || []);
      })
      .catch(() => {
        if (active) setTickets([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [clientEmail]);

  const openCount = tickets.filter((t) => t.status === 'abierto' || t.status === 'en_proceso').length;

  return (
    <Card className="border-border/70 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4 text-primary" /> Casos de soporte
          <Badge variant="secondary" className="ml-1">{tickets.length}</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {openCount > 0 ? `${openCount} caso(s) abierto(s) o en proceso.` : 'Sin casos abiertos.'}
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando casos…
          </p>
        ) : tickets.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-3 text-xs text-muted-foreground">
            Este cliente no tiene casos de soporte registrados.
          </p>
        ) : (
          tickets.map((ticket) => {
            const status = STATUS[ticket.status] || STATUS.cerrado;
            const priority = PRIORITY[ticket.priority] || PRIORITY.media;
            const lastMessage = Array.isArray(ticket.messages) && ticket.messages.length
              ? ticket.messages[ticket.messages.length - 1]
              : null;
            return (
              <div key={ticket.id} className="rounded-2xl border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{ticket.subject}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{ticket.ticket_number}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge className={priority.className}>{priority.label}</Badge>
                    <Badge className={status.className}>{status.label}</Badge>
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {fdate(ticket.created_date)}
                  {ticket.assigned_to ? ` · ${ticket.assigned_to}` : ' · Sin asignar'}
                  {ticket.resolved_date ? ` · resuelto ${fdate(ticket.resolved_date)}` : ''}
                </p>
                {lastMessage?.message ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">Último: {lastMessage.message}</p>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}