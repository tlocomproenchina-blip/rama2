import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight, Mail, MapPin, Phone } from 'lucide-react';
import PendingBillingBultoRow from './PendingBillingBultoRow';

// Un cliente del panel: sus datos, el resumen de su carga y sus bultos con el
// N° de orden/envío al frente, cada uno con su casilla de marcado manual.
export default function PendingBillingClientCard({ client, selected, markingId, onSelect, onMarkBulto }) {
  const bultos = client.bultos || [];
  const receipts = client.receipts || [];

  return (
    <div className={`rounded-xl border p-3 space-y-2 transition-colors ${
      selected ? 'border-primary/50 bg-accent/50' : 'border-border/70'
    }`}>
      <div className="min-w-0 space-y-0.5">
        <p className="font-semibold text-slate-800 break-words">{client.client_name || client.client_email}</p>
        <p className="flex items-center gap-1 text-[11px] text-slate-500 break-all">
          <Mail className="h-3 w-3 shrink-0" /> {client.client_email}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600">
          {client.shipping_mark && <span className="font-mono font-semibold text-blue-700">{client.shipping_mark}</span>}
          {client.state && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {[client.city, client.state].filter(Boolean).join(', ')}
            </span>
          )}
          {client.whatsapp && (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" /> {client.whatsapp}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">{client.totals?.bultos || 0} bulto(s)</Badge>
        <Badge variant="secondary">{client.totals?.packages || 0} paquete(s)</Badge>
        <Badge variant="secondary">{Number(client.totals?.cbm || 0).toFixed(4)} CBM</Badge>
        {receipts.length > 0 && <Badge variant="secondary">{receipts.length} envío(s)</Badge>}
      </div>

      <div className="space-y-2">
        {bultos.map((bulto) => (
          <PendingBillingBultoRow
            key={bulto.id}
            bulto={bulto}
            marking={markingId === bulto.id}
            onMark={onMarkBulto}
          />
        ))}
      </div>

      {receipts.length > 0 && (
        <div className="rounded-lg bg-muted/60 p-2 space-y-1">
          <p className="text-[11px] font-medium text-slate-600">Envíos / recibos CBM pendientes</p>
          {receipts.map((r) => (
            <p key={r.id} className="text-[11px] text-slate-600 break-all">
              <span className="font-mono font-semibold text-slate-800">{r.label}</span>
              {' · '}{Number(r.cbm || 0).toFixed(4)} CBM · {r.package_count || 0} paquete(s)
            </p>
          ))}
        </div>
      )}

      <Button
        size="sm"
        variant={selected ? 'secondary' : 'outline'}
        className="w-full"
        onClick={() => onSelect(client)}
      >
        <ChevronRight className="h-3.5 w-3.5 mr-1" />
        {selected ? 'Cliente cargado' : 'Facturar este cliente'}
      </Button>
    </div>
  );
}