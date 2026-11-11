import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, X } from 'lucide-react';
import { money } from '@/lib/providerInvoicesApi';

export default function ProviderSelectionBar({ selected, isAdmin, onClear, onPay }) {
  if (!selected.length) return null;
  const total = selected.reduce((s, i) => s + (Number(i.total) || 0), 0);
  const totalCbm = selected.reduce((s, i) => s + (Number(i.cbm) || 0), 0);
  const pending = selected.filter((i) => i.status !== 'pagada');
  return (
    <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-accent p-3 shadow-card">
      <p className="text-sm">
        <span className="font-semibold">{selected.length} seleccionada{selected.length === 1 ? '' : 's'}</span>
        <span className="mx-2 text-muted-foreground">·</span>
        Suma <span className="font-display text-lg font-bold">{money(total)}</span>
        <span className="mx-2 text-muted-foreground">·</span>
        <span className="font-display text-lg font-bold">{Number(totalCbm.toFixed(3))}</span> CBM facturados
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onClear}><X />Limpiar</Button>
        {isAdmin && (
          <Button size="sm" onClick={() => onPay(pending)} disabled={!pending.length}>
            <CheckCircle2 />Marcar pagadas{pending.length !== selected.length ? ` (${pending.length})` : ''}
          </Button>
        )}
      </div>
    </div>
  );
}