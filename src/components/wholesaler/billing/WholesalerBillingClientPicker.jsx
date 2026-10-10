import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Search } from 'lucide-react';

// Elegir los clientes del mayorista que entran en la factura del lote.
export default function WholesalerBillingClientPicker({ clients, selected, onToggle, loading }) {
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((client) => [client.full_name, client.email, client.shipping_mark]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(needle));
  }, [clients, query]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por cliente, correo o Shipping Mark"
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando clientes…
        </div>
      ) : !rows.length ? (
        <p className="py-6 text-sm text-muted-foreground">
          Este mayorista no tiene clientes con correo registrado todavía.
        </p>
      ) : (
        <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
          {rows.map((client) => {
            const checked = selected.includes(client.email);
            return (
              <label
                key={client.email}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${checked ? 'border-primary/40 bg-accent/60' : 'border-border/70 hover:bg-accent/40'}`}
              >
                <Checkbox checked={checked} onCheckedChange={() => onToggle(client.email)} className="mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {client.full_name || client.email}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {client.email}{client.shipping_mark ? ` · ${client.shipping_mark}` : ''}
                  </span>
                </span>
                <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  <Badge variant={client.pending_orders ? 'secondary' : 'outline'}>
                    {client.pending_orders} orden(es)
                  </Badge>
                  <Badge variant="outline">{client.pending_bultos || 0} bulto(s)</Badge>
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}