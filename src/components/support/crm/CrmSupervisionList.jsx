import React from 'react';
import { BellRing, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useSupervisorAnsweredCases from '@/hooks/useSupervisorAnsweredCases';

const fdate = (v) => (v ? new Date(v).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

// Casos escalados a Supervisión; al abrir uno se ve su ficha con la respuesta del supervisor.
export default function CrmSupervisionList({ onOpen }) {
  const { filter, setFilter, cases, counts, loading } = useSupervisorAnsweredCases();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant={filter === 'pendientes' ? 'default' : 'outline'} onClick={() => setFilter('pendientes')}>Pendientes de revisión ({counts.pendientes})</Button>
        <Button size="sm" variant={filter === 'revisados' ? 'default' : 'outline'} onClick={() => setFilter('revisados')}>Ya revisados ({counts.revisados})</Button>
      </div>
      {loading ? (
        <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</p>
      ) : !cases.length ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No hay casos en esta lista.</p>
      ) : (
        <ul className="space-y-2">
          {cases.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => onOpen(t.client_email, t.id)} className="w-full rounded-xl border border-border bg-card p-3 text-left hover:bg-accent/40">
                <p className="truncate text-sm font-semibold text-foreground">{t.subject}</p>
                <p className="truncate text-xs text-muted-foreground">{t.ticket_number} · {t.client_email}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  {t.atc_review_status === 'revisado' ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">Revisado</span>
                    : t.supervisor_reply_date ? <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700"><BellRing className="h-3 w-3" /> Respuesta nueva</span>
                    : <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 font-medium text-rose-700"><Clock className="h-3 w-3" /> Esperando al supervisor</span>}
                  <span>{fdate(t.supervisor_reply_date || t.escalated_date || t.created_date)}</span>
                  {t.supervisor_reply_by_name && <span>· {t.supervisor_reply_by_name}</span>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}