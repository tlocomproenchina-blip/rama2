import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UserRound, X } from 'lucide-react';

// Cliente elegido para el lote de etiquetas: sus datos de entrega, tal como saldrán
// impresos en la tira continua.
export default function DispatchLabelClientCard({ client, onChange }) {
  const cityState = [client?.city, client?.state].filter(Boolean).join(', ');

  return (
    <Card>
      <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 shrink-0 rounded-xl bg-primary/10 p-2 text-primary">
            <UserRound className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {client?.full_name || client?.email}
            </p>
            {client?.shipping_mark ? (
              <p className="font-mono text-xs text-primary break-all">MARK: {client.shipping_mark}</p>
            ) : null}
            <p className="text-[11px] text-muted-foreground">
              {[client?.cedula ? `C.I. ${client.cedula}` : '', client?.whatsapp, cityState]
                .filter(Boolean)
                .join(' · ') || client?.email}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={onChange}>
          <X className="h-4 w-4" /> Cambiar
        </Button>
      </CardContent>
    </Card>
  );
}