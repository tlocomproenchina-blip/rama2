import React from 'react';
import { ChevronRight, Mail, MapPin } from 'lucide-react';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Un cliente de la cola de facturación: lo justo para reconocerlo y el peso real
// de lo que le falta facturar. Sus bultos y N° de orden se abren en el expediente.
export default function PendingBillingClientRow({ client, pendingBultos = [], selected, onSelect }) {
  const packages = pendingBultos.reduce((sum, b) => sum + num(b.package_count), 0);
  const cbm = pendingBultos.reduce((sum, b) => sum + num(b.cbm), 0);

  return (
    <button
      type="button"
      onClick={() => onSelect(client)}
      className={`group w-full rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
        selected
          ? 'border-sky-400/50 bg-sky-500/10'
          : 'border-white/10 bg-white/[0.03] hover:border-sky-400/30 hover:bg-white/[0.06]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-slate-100">
          {client.client_name || client.client_email}
        </p>
        <ChevronRight className={`mt-0.5 h-4 w-4 shrink-0 transition-colors ${selected ? 'text-sky-300' : 'text-slate-500 group-hover:text-sky-300'}`} />
      </div>

      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
        <Mail className="h-3 w-3 shrink-0" />
        <span className="truncate">{client.client_email}</span>
      </p>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
        {client.shipping_mark && <span className="font-mono font-semibold text-sky-300">{client.shipping_mark}</span>}
        {client.city && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {[client.city, client.state].filter(Boolean).join(', ')}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
        <span className="rounded-full bg-sky-500/10 px-2 py-0.5 font-semibold text-sky-300 ring-1 ring-inset ring-sky-500/30">
          {pendingBultos.length} bulto(s)
        </span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-300 ring-1 ring-inset ring-white/10">
          {packages} paquete(s)
        </span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-slate-300 ring-1 ring-inset ring-white/10">
          {cbm.toFixed(4)} CBM
        </span>
      </div>
    </button>
  );
}