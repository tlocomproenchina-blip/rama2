import React from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TicketChat from '@/components/support/TicketChat';
import useSupportTicket from '@/hooks/useSupportTicket';

const STATUS_OPTIONS = [
  { value: 'abierto', label: 'Abierto' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'resuelto', label: 'Resuelto' },
  { value: 'cerrado', label: 'Cerrado' },
];
const NONE = '__none__';

// Conversación del caso con el cliente: responder, cambiar estado y departamento.
export default function CrmCaseConversation({ ticketId, user, deps, onMove }) {
  const { ticket, loading, sendMessage, setStatus } = useSupportTicket(ticketId, user);

  if (loading && !ticket) {
    return <p className="flex items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando conversación…</p>;
  }
  if (!ticket) return null;

  const changeDepartment = (value) => onMove(ticket.id, deps.departments.find((d) => d.id === value) || null);

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><MessageSquare className="h-4 w-4 text-primary" /> Conversación con el cliente</p>
          <p className="truncate text-xs text-muted-foreground">{ticket.ticket_number} · {ticket.subject}</p>
        </div>
        <Select value={ticket.department_id || NONE} onValueChange={(v) => changeDepartment(v === NONE ? null : v)}>
          <SelectTrigger className="h-9 w-48"><SelectValue placeholder="Departamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Sin departamento</SelectItem>
            {deps.departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <TicketChat
        messages={ticket.messages || []}
        onSendMessage={sendMessage}
        currentUserEmail={user?.email}
        status={ticket.status}
        onStatusChange={setStatus}
        statusOptions={STATUS_OPTIONS}
        ticketId={ticket.id}
        feedbackReceived={ticket.feedback_received}
        scrollClassName="max-h-[28rem]"
      />
    </section>
  );
}