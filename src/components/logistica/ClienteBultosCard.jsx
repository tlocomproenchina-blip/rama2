import React, { useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { ChevronDown, Loader2, Package } from 'lucide-react';
import EstadoLogisticaBadge from '@/components/logistica/EstadoLogisticaBadge';

export default function ClienteBultosCard({ group }) {
  const [open, setOpen] = useState(false);
  const [bultos, setBultos] = useState(null);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && bultos === null) {
      const rows = await base44.entities.Bulto.filter(
        { client_email: group.email, status: { $ne: 'desarmado' } }, '-created_date', 200
      );
      setBultos(rows || []);
    }
  };

  const name = bultos?.find((b) => b.client_snapshot?.full_name)?.client_snapshot?.full_name;

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70">
      <button type="button" onClick={toggle} className="flex w-full items-start justify-between gap-3 p-4 text-left">
        <div className="min-w-0 space-y-2">
          <p className="truncate font-semibold text-slate-900">{name || group.email}</p>
          {name && <p className="truncate text-xs text-slate-500">{group.email}</p>}
          <p className="text-sm text-slate-600">{group.bultos} bultos · {group.cargas} cargas en ruta</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(group.estados).map(([estado, n]) => (
              <span key={estado} className="flex items-center gap-1"><EstadoLogisticaBadge value={estado} /><span className="text-xs text-slate-500">{n}</span></span>
            ))}
          </div>
        </div>
        <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-slate-100 p-4">
          {bultos === null ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : bultos.length === 0 ? (
            <p className="text-sm text-slate-500">Este cliente no tiene bultos registrados.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {bultos.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-2 rounded-lg bg-card px-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-mono text-slate-800"><Package className="h-4 w-4 shrink-0 text-slate-400" /><span className="truncate">{b.label_code}</span></span>
                  <EstadoLogisticaBadge value={b.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}