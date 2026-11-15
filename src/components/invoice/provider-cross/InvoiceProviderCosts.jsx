import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Link2, Unlink } from 'lucide-react';
import { money } from '@/lib/numbers';
import ProviderCrossDetail from './ProviderCrossDetail';

// Costos de facturas de proveedor vinculadas a esta factura por contenedor.
export default function InvoiceProviderCosts({ invoice }) {
  const [open, setOpen] = useState(null);
  const { data, isLoading } = useQuery({
    queryKey: ['providerCostCross'],
    queryFn: () => base44.functions.invoke('providerCostCross', {}).then((r) => r.data.rows || []),
    staleTime: 60000,
  });
  const rows = (data || []).filter((r) => r.client_invoices.some((i) => i.id === invoice.id));

  return (
    <div className="rounded-xl border bg-card p-3 text-sm" onClick={(e) => e.stopPropagation()}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Costos de proveedor por contenedor</p>
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : rows.length === 0 ? (
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Unlink className="h-3.5 w-3.5" /> Sin coincidencia con facturas de proveedor</p>
      ) : rows.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-0">
          <span className="inline-flex items-center gap-1.5 font-medium text-success"><Link2 className="h-3.5 w-3.5" /> Contenedor {r.container} · {Number(r.cbm || 0)} CBM</span>
          <span className="flex items-center gap-3">
            <span>Costo {money(r.total)}</span>
            <span className="text-success">Pagado {money(r.paid)}</span>
            <span className="font-semibold text-warning">Debe {money(r.balance)}</span>
            <Button size="sm" variant="outline" onClick={() => setOpen(r)}>Ver</Button>
          </span>
        </div>
      ))}
      <ProviderCrossDetail row={open} onClose={() => setOpen(null)} />
    </div>
  );
}