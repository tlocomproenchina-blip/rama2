import React from 'react';
import { ShieldCheck } from 'lucide-react';
import CrmTagBadges from './CrmTagBadges';

const PRIORITY = {
  urgente: 'bg-red-100 text-red-700', alta: 'bg-orange-100 text-orange-700',
  media: 'bg-blue-100 text-blue-700', baja: 'bg-slate-100 text-slate-600',
};

const ago = (v) => (v ? new Date(v).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

// Casos abiertos, primero los que esperan respuesta del equipo.
export default function CrmCasesList({ cases = [], profiles = {}, tagsByEmail = {}, catalog, onOpen }) {
  if (!cases.length) {
    return <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No hay casos abiertos.</p>;
  }

  return (
    <ul className="space-y-2">
      {cases.map((c) => (
        <li key={c.id}>
          <button type="button" onClick={() => onOpen(c.client_email, c.id)} className="w-full rounded-xl border border-border bg-card p-3 text-left hover:bg-accent/40">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{profiles[c.client_email]?.name || c.client_email}</p>
                <p className="truncate text-xs text-muted-foreground">{c.ticket_number} · {c.subject}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {c.waiting && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700">Espera respuesta</span>}
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY[c.priority] || PRIORITY.media}`}>{c.priority}</span>
              </div>
            </div>
            {c.last_message?.message && (
              <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                {c.last_message.is_admin ? 'Equipo: ' : 'Cliente: '}{c.last_message.message}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {c.escalated && <span className="flex items-center gap-1 text-[11px] text-violet-700"><ShieldCheck className="h-3 w-3" /> Supervisión</span>}
              {c.department_name && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">{c.department_name}</span>}
              <span className="text-[11px] text-muted-foreground">{ago(c.last_message?.timestamp || c.updated_date)}</span>
              <CrmTagBadges tags={tagsByEmail[c.client_email]} catalog={catalog} />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}