import React from 'react';
import { AlertCircle, CheckCircle2, Clock, Flame, FolderX, Inbox, UserX } from 'lucide-react';
import { supervisionState } from '@/lib/supervisionState';

const hoursSince = (iso) => (iso ? (Date.now() - new Date(iso).getTime()) / 3600000 : null);
const fmtHours = (h) => (h == null ? '—' : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toFixed(1)} h` : `${Math.round(h / 24)} días`);

// Indicadores de supervisión calculados sobre los casos abiertos de la bandeja.
export default function SupervisorMetrics({ cases = [], departments = [] }) {
  const pending = cases.filter((c) => supervisionState(c) === 'pendiente');
  const waits = pending.map((c) => hoursSince(c.escalated_date || c.created_date)).filter((h) => h != null);
  const avgWait = waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : null;
  const known = new Set(departments.map((d) => d.id));

  const cards = [
    { label: 'Casos abiertos', value: cases.length, icon: Inbox, tone: 'text-primary bg-accent' },
    { label: 'Pendientes supervisión', value: pending.length, icon: AlertCircle, tone: 'text-red-700 bg-red-50' },
    { label: 'Atendidos', value: cases.filter((c) => supervisionState(c) === 'atendido').length, icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-50' },
    { label: 'Urgentes / alta', value: cases.filter((c) => ['urgente', 'alta'].includes(c.priority)).length, icon: Flame, tone: 'text-orange-700 bg-orange-50' },
    { label: 'Sin departamento', value: cases.filter((c) => !known.has(c.department_id)).length, icon: FolderX, tone: 'text-slate-700 bg-slate-100' },
    { label: 'Sin responsable', value: cases.filter((c) => !c.assigned_to).length, icon: UserX, tone: 'text-violet-700 bg-violet-50' },
    { label: 'Espera promedio', value: fmtHours(avgWait), hint: `Máx: ${fmtHours(waits.length ? Math.max(...waits) : null)}`, icon: Clock, tone: 'text-amber-700 bg-amber-50' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
      {cards.map(({ label, value, hint, icon: Icon, tone }) => (
        <div key={label} className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-card">
          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${tone}`}><Icon className="h-4 w-4" /></span>
          <p className="mt-2 font-display text-2xl font-bold text-foreground">{value}</p>
          <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
          {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
        </div>
      ))}
    </div>
  );
}