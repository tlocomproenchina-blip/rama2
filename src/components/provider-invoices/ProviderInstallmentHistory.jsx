import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Trash2 } from 'lucide-react';
import { money } from '@/lib/providerInvoicesApi';

export default function ProviderInstallmentHistory({ items, onDelete }) {
  if (!items.length) return <p className="py-2 text-center text-sm text-muted-foreground">Aún no hay abonos registrados.</p>;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Historial de abonos</p>
      {items.map((it) => (
        <div key={it.id} className="flex items-center justify-between gap-2 rounded-xl border p-3">
          <div>
            <p className="font-display font-semibold">{money(it.amount)}</p>
            <p className="text-xs text-muted-foreground">{it.payment_date || '—'}{it.registered_by_name ? ` · ${it.registered_by_name}` : ''}</p>
          </div>
          <div className="flex items-center gap-1">
            {it.proof_url && <Button variant="outline" size="sm" asChild><a href={it.proof_url} target="_blank" rel="noreferrer"><CheckCircle2 />Comprobante</a></Button>}
            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => onDelete(it.id)} title="Eliminar abono"><Trash2 /></Button>
          </div>
        </div>
      ))}
    </div>
  );
}