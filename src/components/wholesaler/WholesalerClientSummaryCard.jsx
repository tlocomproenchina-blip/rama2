import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown } from 'lucide-react';
import WholesalerClientTrackingRow from './WholesalerClientTrackingRow';
import { shipmentWhen } from '@/lib/wholesalerShipmentStatus';

const chips = [
  { key: 'enviados', label: 'enviados', tone: 'bg-emerald-100 text-emerald-700' },
  { key: 'pendientes', label: 'pendientes', tone: 'bg-amber-100 text-amber-700' },
  { key: 'fallidos', label: 'fallidos', tone: 'bg-rose-100 text-rose-700' },
  { key: 'sin_aviso', label: 'sin aviso', tone: 'bg-slate-100 text-slate-600' },
];

// Un cliente del mayorista: su carga y, al abrirlo, el estado de cada tracking.
export default function WholesalerClientSummaryCard({ client, onResent }) {
  const [open, setOpen] = useState(false);
  const active = chips.filter((chip) => Number(client?.[chip.key]) > 0);

  return (
    <div className="rounded-xl border border-border/70 bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-display text-sm font-semibold text-foreground">
          {client.client_name || client.client_email || 'Cliente sin identificar'}
        </p>
        {client.shipping_mark && (
          <Badge variant="outline" className="font-mono text-xs">{client.shipping_mark}</Badge>
        )}
        {client.client_name && client.client_email && (
          <span className="text-xs text-muted-foreground">{client.client_email}</span>
        )}
        <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
          {client.total} tracking(s) · {shipmentWhen(client.last_activity)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {active.map((chip) => (
          <Badge key={chip.key} className={chip.tone}>{client[chip.key]} {chip.label}</Badge>
        ))}
      </div>

      <Button size="sm" variant="ghost" onClick={() => setOpen((prev) => !prev)} className="mt-2 gap-1">
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        {open ? 'Ocultar trackings' : `Ver trackings (${client.total})`}
      </Button>

      {open && (
        <div className="mt-2 space-y-1.5 border-t border-border/70 pt-2">
          {(client.trackings || []).map((tracking) => (
            <WholesalerClientTrackingRow
              key={tracking.tracking_number || 'sin_tracking'}
              tracking={tracking}
              onResent={onResent}
            />
          ))}
        </div>
      )}
    </div>
  );
}