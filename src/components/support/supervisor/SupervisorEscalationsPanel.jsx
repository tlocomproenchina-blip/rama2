import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Paperclip, ShieldCheck, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import SupervisorCaseFile from './SupervisorCaseFile';
import ReplyStatusFilter from './ReplyStatusFilter';

const PRIORITY = {
  baja: 'bg-slate-100 text-slate-600',
  media: 'bg-blue-100 text-blue-600',
  alta: 'bg-orange-100 text-orange-600',
  urgente: 'bg-red-100 text-red-600',
};

const PRIORITY_ORDER = { urgente: 0, alta: 1, media: 2, baja: 3 };

const fdate = (value) => (value
  ? new Date(value).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '');

const attachmentCount = (ticket) => (ticket.messages || [])
  .reduce((total, message) => total + (message.attachments?.length || 0), 0);

// Pestaña Supervisor: los casos que el ATC escaló, pendientes primero, con su
// expediente completo al abrirlos.
export default function SupervisorEscalationsPanel({ user, initialTicketId = '' }) {
  const [scope, setScope] = useState('todos');
  const [replyFilter, setReplyFilter] = useState('sin_responder');
  const [cases, setCases] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Lo escalado que Supervisión aún no atendió, o cuya respuesta el ATC
      // todavía no cerró. Un caso sin atender sigue visible aunque el ATC ya le
      // haya escrito al cliente.
      const query = {
        escalated: true,
        $or: [{ escalation_status: 'pendiente' }, { atc_review_status: { $ne: 'revisado' } }],
      };

      const [rows, total] = await Promise.all([
        base44.entities.SupportTicket.filter(query, '-escalated_date', 50),
        base44.entities.SupportTicket.count(query),
      ]);

      const mine = (ticket) => ticket.assigned_to === user?.email || ticket.escalated_by === user?.email;
      setCases(scope === 'mios' && user?.email ? (rows || []).filter(mine) : (rows || []));
      setPendingCount(total || 0);
    } catch {
      toast.error('No se pudieron cargar los casos escalados');
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [scope, user?.email]);

  useEffect(() => { load(); }, [load]);

  // En vivo: el departamento de cada caso se actualiza cuando otro usuario lo cambia.
  useEffect(() => base44.entities.SupportTicket.subscribe((event) => {
    if (event.type !== 'update' || !event.data) return;
    const patch = { department_id: event.data.department_id || '', department_name: event.data.department_name || '' };
    setCases((prev) => prev.map((item) => (item.id === event.id ? { ...item, ...patch } : item)));
  }), []);

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

  const isAnswered = (ticket) => !!ticket.supervisor_reply_date;
  const replyCounts = {
    sin_responder: cases.filter((t) => !isAnswered(t)).length,
    respondidos: cases.filter(isAnswered).length,
    todos: cases.length,
  };
  const visible = replyFilter === 'todos'
    ? cases
    : cases.filter((t) => (replyFilter === 'respondidos' ? isAnswered(t) : !isAnswered(t)));

  const ordered = [...visible].sort((a, b) => {
    const aPending = a.atc_review_status === 'revisado' ? 1 : 0;
    const bPending = b.atc_review_status === 'revisado' ? 1 : 0;
    if (aPending !== bPending) return aPending - bPending;
    const aPriority = PRIORITY_ORDER[a.priority] ?? 2;
    const bPriority = PRIORITY_ORDER[b.priority] ?? 2;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return new Date(b.escalated_date || b.created_date || 0).getTime() - new Date(a.escalated_date || a.created_date || 0).getTime();
  });

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      <div className={`space-y-3 ${selected ? 'hidden lg:block' : ''}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">Pendientes de revisión</p>
          {pendingCount > 0 ? <Badge variant="secondary">{pendingCount}</Badge> : null}
        </div>

        <Button
          size="sm"
          variant={scope === 'mios' ? 'secondary' : 'ghost'}
          className="w-full justify-start"
          onClick={() => setScope(scope === 'mios' ? 'todos' : 'mios')}
        >
          <ShieldCheck className="mr-2 h-3.5 w-3.5" />
          {scope === 'mios' ? 'Mostrando mis casos' : 'Ver solo mis casos'}
        </Button>

        <ReplyStatusFilter value={replyFilter} onChange={setReplyFilter} counts={replyCounts} />

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
              <p>
                {replyFilter === 'sin_responder'
                  ? 'No tienes casos sin responder.'
                  : replyFilter === 'respondidos'
                    ? 'No hay casos respondidos pendientes de cierre.'
                    : 'No hay casos pendientes de revisión.'}
              </p>
              <p className="text-xs">
                Los casos que se elevan desde la lista de Tickets o desde el Asistente ATC aparecen aquí hasta que el ATC los cierre.
              </p>
              {(scope !== 'todos' || replyFilter !== 'todos') && (
                <Button size="sm" variant="outline" onClick={() => { setScope('todos'); setReplyFilter('todos'); }}>
                  Ver todos los casos
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {ordered.map((ticket) => {
              const reviewed = ticket.atc_review_status === 'revisado';
              const awaitingReply = !ticket.supervisor_reply_date;
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
                    <Badge className={`${reviewed ? 'bg-emerald-100 text-emerald-700' : awaitingReply ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'} text-[10px]`}>
                      {reviewed ? 'Revisada por el ATC' : awaitingReply ? 'Pendiente' : 'Respondida · ATC por cerrar'}
                    </Badge>
                    {ticket.department_name ? (
                      <Badge className="bg-accent text-accent-foreground text-[10px]">{ticket.department_name}</Badge>
                    ) : null}
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