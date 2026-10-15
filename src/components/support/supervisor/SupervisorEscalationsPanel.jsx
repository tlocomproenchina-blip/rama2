import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Paperclip, ShieldCheck, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import SupervisorCaseFile from './SupervisorCaseFile';

const PRIORITY = {
  baja: 'bg-slate-100 text-slate-600',
  media: 'bg-blue-100 text-blue-600',
  alta: 'bg-orange-100 text-orange-600',
  urgente: 'bg-red-100 text-red-600',
};

const PRIORITY_ORDER = { urgente: 0, alta: 1, media: 2, baja: 3 };

const FILTERS = [
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'atendida', label: 'Atendidas' },
  { value: 'todas', label: 'Todas' },
];

const fdate = (value) => (value
  ? new Date(value).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '');

const attachmentCount = (ticket) => (ticket.messages || [])
  .reduce((total, message) => total + (message.attachments?.length || 0), 0);

// Pestaña Supervisor: los casos que el ATC escaló, pendientes primero, con su
// expediente completo al abrirlos.
export default function SupervisorEscalationsPanel({ user, initialTicketId = '' }) {
  const [statusFilter, setStatusFilter] = useState('pendiente');
  const [scope, setScope] = useState('todos');
  const [cases, setCases] = useState([]);
  const [counts, setCounts] = useState({ pendiente: 0, atendida: 0 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = { escalated: true };
      if (statusFilter !== 'todas') query.escalation_status = statusFilter;
      if (scope === 'mios' && user?.email) query.assigned_to = user.email;

      const [rows, totals] = await Promise.all([
        base44.entities.SupportTicket.filter(query, '-escalated_date', 50),
        base44.entities.SupportTicket.aggregate({ query: { escalated: true }, groupBy: 'escalation_status' }),
      ]);

      setCases(rows || []);
      const byStatus = {};
      (totals?.rows || []).forEach((row) => {
        byStatus[row.escalation_status || 'pendiente'] = row.count;
      });
      setCounts({ pendiente: byStatus.pendiente || 0, atendida: byStatus.atendida || 0 });
    } catch {
      toast.error('No se pudieron cargar los casos escalados');
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, scope, user?.email]);

  useEffect(() => { load(); }, [load]);

  // Llegada desde la notificación: ?ticketId=... abre ese caso directamente.
  useEffect(() => {
    if (!initialTicketId || selected) return undefined;
    let active = true;
    base44.entities.SupportTicket.get(initialTicketId)
      .then((ticket) => { if (active && ticket) setSelected(ticket); })
      .catch(() => toast.error('No se encontró el caso escalado'));
    return () => { active = false; };
  }, [initialTicketId, selected]);

  const handleTicketChange = (updated) => {
    setCases((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setSelected(updated);
  };

  const ordered = [...cases].sort((a, b) => {
    const aPending = (a.escalation_status || 'pendiente') === 'pendiente' ? 0 : 1;
    const bPending = (b.escalation_status || 'pendiente') === 'pendiente' ? 0 : 1;
    if (aPending !== bPending) return aPending - bPending;
    const aPriority = PRIORITY_ORDER[a.priority] ?? 2;
    const bPriority = PRIORITY_ORDER[b.priority] ?? 2;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return new Date(b.escalated_date || b.created_date || 0).getTime() - new Date(a.escalated_date || a.created_date || 0).getTime();
  });

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      <div className={`space-y-3 ${selected ? 'hidden lg:block' : ''}`}>
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((filter) => (
            <Button
              key={filter.value}
              size="sm"
              variant={statusFilter === filter.value ? 'default' : 'outline'}
              onClick={() => setStatusFilter(filter.value)}
            >
              {filter.label}
              {filter.value === 'pendiente' && counts.pendiente > 0 ? <span className="ml-1.5 text-xs">{counts.pendiente}</span> : null}
              {filter.value === 'atendida' && counts.atendida > 0 ? <span className="ml-1.5 text-xs">{counts.atendida}</span> : null}
            </Button>
          ))}
        </div>

        <Button
          size="sm"
          variant={scope === 'mios' ? 'secondary' : 'ghost'}
          className="w-full justify-start"
          onClick={() => setScope(scope === 'mios' ? 'todos' : 'mios')}
        >
          <ShieldCheck className="mr-2 h-3.5 w-3.5" />
          {scope === 'mios' ? 'Mostrando solo mis casos' : 'Ver solo los casos asignados a mí'}
        </Button>

        {loading ? (
          <Card className="border-border/70 shadow-card">
            <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando casos escalados…
            </CardContent>
          </Card>
        ) : ordered.length === 0 ? (
          <Card className="border-dashed border-border shadow-none">
            <CardContent className="space-y-2 py-6 text-center text-sm text-muted-foreground">
              <Inbox className="mx-auto h-6 w-6 text-muted-foreground" />
              <p>No hay casos escalados en esta vista.</p>
              <p className="text-xs">
                Cuando el ATC escale un caso desde el asistente, aparecerá aquí con todo su expediente.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {ordered.map((ticket) => {
              const isPending = (ticket.escalation_status || 'pendiente') === 'pendiente';
              const files = attachmentCount(ticket);
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
                    <Badge className={`${isPending ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'} text-[10px]`}>
                      {isPending ? 'Pendiente' : 'Atendida'}
                    </Badge>
                    {files > 0 ? (
                      <span className="flex items-center gap-0.5"><Paperclip className="h-3 w-3" /> {files}</span>
                    ) : null}
                    <span>{fdate(ticket.escalated_date || ticket.created_date)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className={selected ? '' : 'hidden lg:block'}>
        {selected ? (
          <SupervisorCaseFile
            ticket={selected}
            user={user}
            onBack={() => setSelected(null)}
            onChange={handleTicketChange}
          />
        ) : (
          <Card className="border-dashed border-border shadow-none">
            <CardContent className="space-y-2 py-12 text-center text-sm text-muted-foreground">
              <ShieldCheck className="mx-auto h-7 w-7 text-primary" />
              <p className="font-medium text-foreground">Elige un caso escalado</p>
              <p className="text-xs">
                Verás su chat previo, las fotos y documentos del ATC, los datos del cliente y todo su historial: paquetes, seguro, bultos, recibos, facturas y órdenes de despacho, sin salir de aquí.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}