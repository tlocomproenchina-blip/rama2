import React, { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CrmTagBadges from './CrmTagBadges';

const fdate = (v) => (v ? new Date(`${v}T12:00:00`).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' }) : 'Sin fecha');

// Seguimientos pendientes, primero los vencidos.
export default function CrmAgendaList({ agenda = [], tagsByEmail = {}, catalog, onOpen, onDone }) {
  const [doneId, setDoneId] = useState(null);

  if (!agenda.length) {
    return <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No hay seguimientos pendientes.</p>;
  }

  return (
    <ul className="space-y-2">
      {agenda.map((row) => (
        <li key={row.id} className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-start justify-between gap-2">
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(row.client_email, row.ticket_id)}>
              <p className="truncate text-sm font-semibold text-foreground">{row.client_name || row.client_email}</p>
              <p className="mt-0.5 line-clamp-2 text-sm text-foreground">{row.next_action}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {row.responsible_name || row.responsible_email}
                {row.ticket_number ? ` · Caso ${row.ticket_number}` : ''}
              </p>
            </button>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${row.overdue ? 'bg-rose-100 text-rose-700' : row.is_today ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'}`}>
              {row.overdue ? `Vencido ${fdate(row.due_date)}` : row.is_today ? 'Hoy' : fdate(row.due_date)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <CrmTagBadges tags={tagsByEmail[row.client_email]} catalog={catalog} />
            <Button
              size="sm"
              variant="outline"
              className="ml-auto shrink-0"
              disabled={doneId === row.id}
              onClick={async () => { setDoneId(row.id); await onDone(row); setDoneId(null); }}
            >
              {doneId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Hecho
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}