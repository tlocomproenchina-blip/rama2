import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

// Una tarjeta por cliente: selección, totales y detalle de sus contenedores
// con los bultos que salieron en las guías de despacho.
export default function ClientContainersCard({ group, selected, onToggle }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={cn('overflow-hidden border transition', selected ? 'border-primary/60 bg-primary/5' : 'border-border')}>
      <div className="flex items-start gap-3 p-4">
        <Checkbox checked={selected} onCheckedChange={() => onToggle(group.key)} className="mt-1" />

        <button type="button" onClick={() => setExpanded((value) => !value)} className="flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{group.name}</p>
            {group.shipping_mark && (
              <Badge variant="outline" className="font-mono text-[10px] tracking-wide">{group.shipping_mark}</Badge>
            )}
          </div>
          {group.email && <p className="mt-0.5 text-xs text-muted-foreground">{group.email}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-semibold text-foreground">
              <Package className="h-3.5 w-3.5" /> {group.totalContainers} contenedor{group.totalContainers === 1 ? '' : 'es'}
            </span>
            <span>{group.totalBultos} bulto{group.totalBultos === 1 ? '' : 's'} en guías de despacho</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-accent"
          aria-label="Ver contenedores"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
        </button>
      </div>

      {expanded && (
        <div className="overflow-x-auto border-t border-border/70">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Contenedor</th>
                <th className="px-4 py-2 text-center">Bultos</th>
                <th className="px-4 py-2">Descripción</th>
              </tr>
            </thead>
            <tbody>
              {group.containers.map((row) => (
                <tr key={row.container} className="border-t border-border/50 align-top">
                  <td className="px-4 py-2 font-semibold text-foreground">{row.container}</td>
                  <td className="px-4 py-2 text-center font-semibold text-foreground">{Number(row.bultos || 0)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{row.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}