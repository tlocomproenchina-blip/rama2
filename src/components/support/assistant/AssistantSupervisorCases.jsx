import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BellRing, Clock, Inbox, Loader2, ShieldCheck } from 'lucide-react';
import useSupervisorAnsweredCases from '@/hooks/useSupervisorAnsweredCases';
import SupervisorAnsweredCase from '@/components/support/assistant/SupervisorAnsweredCase';

const PRIORITY = {
  baja: 'bg-slate-100 text-slate-600',
  media: 'bg-blue-100 text-blue-600',
  alta: 'bg-orange-100 text-orange-600',
  urgente: 'bg-red-100 text-red-600',
};

const FILTERS = [
  { value: 'pendientes', label: 'Pendientes de revisión' },
  { value: 'revisados', label: 'Ya revisados' },
];

const fdate = (value) => (value
  ? new Date(value).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '');

// Bandeja del ATC con los casos que Supervisión ya respondió: arriba los últimos
// respondidos y al abrirlos se ve el expediente completo con la respuesta
// interna del supervisor, lista para cargarla en el asistente de respuestas.
export default function AssistantSupervisorCases({ user, onLoadToAssistant }) {
  const { filter, setFilter, cases, counts, loading, reload } = useSupervisorAnsweredCases();
  const [selected, setSelected] = useState(null);

  const handleChange = (updated) => {
    setSelected((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
    reload();
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      <div className={`space-y-3 ${selected ? 'hidden lg:block' : ''}`}>
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((item) => (
            <Button
              key={item.value}
              size="sm"
              variant={filter === item.value ? 'default' : 'outline'}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
              {item.value === 'pendientes' && counts.pendientes > 0 ? <span className="ml-1.5 text-xs">{counts.pendientes}</span> : null}
              {item.value === 'revisados' && counts.revisados > 0 ? <span className="ml-1.5 text-xs">{counts.revisados}</span> : null}
            </Button>
          ))}
        </div>

        {loading ? (
          <Card className="border-border/70 shadow-card">
            <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando los casos respondidos…
            </CardContent>
          </Card>
        ) : cases.length === 0 ? (
          <Card className="border-dashed border-border shadow-none">
            <CardContent className="space-y-2 py-6 text-center text-sm text-muted-foreground">
              <Inbox className="mx-auto h-6 w-6 text-muted-foreground" />
              <p>{filter === 'revisados' ? 'Todavía no has revisado ningún caso.' : 'No hay casos pendientes de revisión.'}</p>
              <p className="text-xs">
                Aquí entran todos los casos escalados a Supervisión, también los que se elevan desde la lista de Tickets. Quedan pendientes hasta que los cierres con «Marcar atendido».
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {cases.map((ticket) => {
              const reviewed = ticket.atc_review_status === 'revisado';
              const awaitingSupervisor = !ticket.supervisor_reply_date;
              return (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setSelected(ticket)}
                  className={`w-full rounded-2xl border p-3 text-left transition ${
                    selected?.id === ticket.id ? 'border-primary/40 bg-primary/5' : 'border-border/70 bg-card hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">{ticket.ticket_number}</span>
                    <Badge className={`${PRIORITY[ticket.priority] || PRIORITY.media} text-[10px]`}>{ticket.priority || 'media'}</Badge>
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-foreground">{ticket.subject}</p>
                  <p className="truncate text-xs text-muted-foreground">{ticket.client_email}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                    {reviewed ? (
                      <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Revisado</Badge>
                    ) : awaitingSupervisor ? (
                      <Badge className="bg-amber-100 text-amber-700 text-[10px]">
                        <Clock className="mr-1 h-3 w-3" /> Esperando al supervisor
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 text-[10px]">
                        <BellRing className="mr-1 h-3 w-3" /> Respuesta nueva
                      </Badge>
                    )}
                    <span>{fdate(ticket.supervisor_reply_date || ticket.escalated_date || ticket.created_date)}</span>
                    {awaitingSupervisor && ticket.escalated_by_name ? <span>· {ticket.escalated_by_name}</span> : null}
                    {ticket.supervisor_reply_by_name ? <span>· {ticket.supervisor_reply_by_name}</span> : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className={selected ? '' : 'hidden lg:block'}>
        {selected ? (
          <SupervisorAnsweredCase
            ticket={selected}
            user={user}
            onBack={() => setSelected(null)}
            onChange={handleChange}
            onLoadToAssistant={onLoadToAssistant}
          />
        ) : (
          <Card className="border-dashed border-border shadow-none">
            <CardContent className="space-y-2 py-12 text-center text-sm text-muted-foreground">
              <ShieldCheck className="mx-auto h-7 w-7 text-primary" />
              <p className="font-medium text-foreground">Elige un caso respondido</p>
              <p className="text-xs">
                Verás la respuesta del supervisor, el resumen del caso, la conversación con el cliente, sus datos y todo su historial, además de la respuesta que le enviarás al cliente.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}