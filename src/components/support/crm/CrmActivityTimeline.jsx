import React from 'react';
import { Loader2, MessageSquare, Package, Receipt, StickyNote, ListTodo } from 'lucide-react';
import useClientActivity from '@/hooks/useClientActivity';

const ICONS = { caso: MessageSquare, paquete: Package, factura: Receipt, nota: StickyNote, tarea: ListTodo };

const fdate = (v) => new Date(v).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function CrmActivityTimeline({ clientEmail }) {
  const { events, loading } = useClientActivity(clientEmail);

  if (loading) return <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando actividad…</p>;
  if (!events.length) return <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Este cliente todavía no tiene actividad.</p>;

  return (
    <ol className="relative space-y-3 border-l border-border pl-5">
      {events.map((e, i) => {
        const Icon = ICONS[e.type] || MessageSquare;
        return (
          <li key={`${e.date}-${i}`} className="relative">
            <span className="absolute -left-[1.85rem] flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card">
              <Icon className="h-3.5 w-3.5 text-primary" />
            </span>
            <p className="text-[11px] text-muted-foreground">{fdate(e.date)}</p>
            <p className="line-clamp-3 text-sm text-foreground">{e.text}</p>
          </li>
        );
      })}
    </ol>
  );
}