import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import PublicClientDataGrid from '@/components/public-guides/PublicClientDataGrid';

// Tarjeta de solo lectura del portal público de guías: un cliente con sus
// contenedores y los bultos que salieron en las guías de despacho.
export default function PublicClientContainersCard({ client }) {
  const [expanded, setExpanded] = useState(false);
  const containers = client.containers || [];
  const totalBultos = Number(client?.totals?.bultos) || 0;

  return (
    <Card className="overflow-hidden border-border">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-accent/40"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{client.name}</p>
            {client.shipping_mark && (
              <Badge variant="outline" className="font-mono text-[10px] tracking-wide">
                {client.shipping_mark}
              </Badge>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-semibold text-foreground">
              <Package className="h-3.5 w-3.5" /> {containers.length} contenedor{containers.length === 1 ? '' : 'es'}
            </span>
            <span>
              {totalBultos} bulto{totalBultos === 1 ? '' : 's'} en guías de despacho
            </span>
          </div>
        </div>
        <span className="mt-1 shrink-0 text-[11px] font-semibold text-muted-foreground">
          {expanded ? 'Ocultar' : 'Ver contenedores'}
        </span>
        <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
      </button>

      <PublicClientDataGrid client={client} />

      {expanded && (
        <div className="overflow-x-auto border-t border-border/70">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Contenedor</th>
                <th className="px-3 py-2 text-center">Bultos</th>
                <th className="px-3 py-2">Guía</th>
                <th className="px-3 py-2">Descripción</th>
              </tr>
            </thead>
            <tbody>
              {containers.map((row) => (
                <tr key={row.container} className="border-t border-border/50 align-top">
                  <td className="px-3 py-2 font-semibold text-foreground">{row.container}</td>
                  <td className="px-3 py-2 text-center font-semibold text-foreground">{Number(row.bultos || 0)}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                    {(row.guides || []).join(', ') || '—'}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}