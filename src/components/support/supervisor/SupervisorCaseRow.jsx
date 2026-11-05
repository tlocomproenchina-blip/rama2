import React from 'react';
import { ChevronRight } from 'lucide-react';
import { supervisionState, SUPERVISION_STYLE } from '@/lib/supervisionState';

const PRIORITY = {
  urgente: 'bg-red-100 text-red-700', alta: 'bg-orange-100 text-orange-700',
  media: 'bg-blue-100 text-blue-700', baja: 'bg-slate-100 text-slate-600',
};
const fdate = (v) => (v ? new Date(v).toLocaleString('es-VE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

// Fila de la bandeja del supervisor.
export default function SupervisorCaseRow({ item, name, assigneeName, onOpen }) {
  const sup = SUPERVISION_STYLE[supervisionState(item)];
  return (
    <button
      type="button"
      onClick={() => onOpen(item.client_email, item.id)}
      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-accent/50 ${sup ? sup.card : 'border-border bg-card'}`}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
          <span className="font-mono text-[11px] text-muted-foreground">{item.ticket_number}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY[item.priority] || PRIORITY.media}`}>{item.priority}</span>
          {sup && <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${sup.badge}`}>{sup.label}</span>}
          {item.waiting && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700">Espera respuesta</span>}
        </div>
        <p className="truncate text-xs text-muted-foreground">{item.subject}</p>
        <p className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
          <span>Departamento: <b className="font-medium text-foreground">{item.department_name || 'Sin departamento'}</b></span>
          <span>Responsable: <b className="font-medium text-foreground">{assigneeName || 'Sin asignar'}</b></span>
          {item.escalated && <span>Escalado: {fdate(item.escalated_date)}{item.escalated_by_name ? ` por ${item.escalated_by_name}` : ''}</span>}
          <span>Actividad: {fdate(item.last_message?.timestamp || item.updated_date)}</span>
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}