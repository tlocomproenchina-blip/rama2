import React from 'react';
import { ChevronRight, Mail, MapPin } from 'lucide-react';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Un cliente de la cola de facturación: lo justo para reconocerlo y el peso real
// de lo que le falta facturar. Sus bultos y N° de contenedor se abren en el expediente.
export default function PendingBillingClientRow({ client, pendingBultos = [], selected, onSelect }) {
  const packages = pendingBultos.reduce((sum, b) => sum + num(b.package_count), 0);
  const cbm = pendingBultos.reduce((sum, b) => sum + num(b.cbm), 0);

  return (
    <button
      type="button"
      onClick={() => onSelect(client)}
      className={`group w-full rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        selected
          ? 'border-primary/50 bg-primary/10'
          : 'border-border bg-card hover:border-primary/40 hover:bg-accent/60'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-foreground">
          {client.client_name || client.client_email}
        </p>
        <ChevronRight className={`mt-0.5 h-4 w-4 shrink-0 transition-colors ${selected ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'}`} />
      </div>

      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
        <Mail className="h-3 w-3 shrink-0" />
        <span className="truncate">{client.client_email}</span>
      </p>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
        {client.shipping_mark && <span className="font-mono font-semibold text-primary">{client.shipping_mark}</span>}
        {client.city && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {[client.city, client.state].filter(Boolean).join(', ')}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary ring-1 ring-inset ring-primary/30">
          {pendingBultos.length} bulto(s)
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground ring-1 ring-inset ring-border">
          {packages} paquete(s)
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground ring-1 ring-inset ring-border">
          {cbm.toFixed(4)} CBM
        </span>
      </div>
    </button>
  );
}