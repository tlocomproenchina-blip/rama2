import React from 'react';
import { MessageCircleWarning, AlarmClock, CalendarCheck, ShieldCheck, Inbox } from 'lucide-react';

const ITEMS = [
  { key: 'waiting_clients', label: 'Esperan respuesta', icon: MessageCircleWarning, tone: 'text-rose-600' },
  { key: 'overdue', label: 'Seguimientos vencidos', icon: AlarmClock, tone: 'text-amber-600' },
  { key: 'today', label: 'Tareas de hoy', icon: CalendarCheck, tone: 'text-primary' },
  { key: 'supervision', label: 'Con supervisión', icon: ShieldCheck, tone: 'text-violet-600' },
  { key: 'open_cases', label: 'Casos abiertos', icon: Inbox, tone: 'text-slate-600' },
];

// Los cinco indicadores de la jornada del agente.
export default function CrmKpis({ kpis, loading }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {ITEMS.map(({ key, label, icon: Icon, tone }) => (
        <div key={key} className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon className={`h-4 w-4 shrink-0 ${tone}`} />
            <span className="truncate">{label}</span>
          </div>
          <p className="mt-1 font-display text-2xl font-bold text-foreground">
            {loading ? '…' : (kpis?.[key] ?? 0)}
          </p>
        </div>
      ))}
    </div>
  );
}