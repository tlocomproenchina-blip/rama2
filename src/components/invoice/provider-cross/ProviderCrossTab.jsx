import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { money } from '@/lib/numbers';
import ProviderCrossDetail from './ProviderCrossDetail';

// Cruce factura de proveedor ↔ facturas del cliente por contenedor.
export default function ProviderCrossTab({ search }) {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    base44.functions.invoke('providerCostCross', {}).then((r) => setRows(r.data.rows || []));
  }, []);

  const list = useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    if (!q) return rows || [];
    return (rows || []).filter((r) => [r.container, r.client_name, r.client_email, r.shipping_mark]
      .some((v) => String(v || '').toLowerCase().includes(q)));
  }, [rows, search]);

  if (!rows) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  const owed = list.reduce((s, r) => s + r.balance, 0);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{list.length} contenedor(es) · Deuda al proveedor: <b className="text-foreground">{money(owed)}</b></p>
      {list.length === 0 && <p className="py-8 text-center text-muted-foreground">No hay facturas de proveedor.</p>}
      {list.map((r) => (
        <Card key={r.id} className="cursor-pointer transition hover:shadow-premium" onClick={() => setOpen(r)}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="font-display font-semibold">{r.container} · {r.client_name || r.client_email}</p>
              <p className="text-xs text-muted-foreground">
                {r.shipping_mark} · Factura cliente: {r.client_invoices.map((i) => i.invoice_number).join(', ') || 'sin coincidencia'}
              </p>
              <div className="mt-1 flex gap-1">
                {r.client_invoices.length === 0 && <Badge variant="outline">Sin factura de cliente</Badge>}
                {r.shared_container > 0 && <Badge variant="outline">Contenedor con {r.shared_container} facturas de proveedor</Badge>}
                {!r.invoice_file_url && <Badge variant="outline">Sin foto de factura</Badge>}
              </div>
            </div>
            <div className="flex gap-5 text-right text-sm">
              <div><p className="text-xs text-muted-foreground">Costo</p><p className="font-semibold">{money(r.total)}</p></div>
              <div><p className="text-xs text-muted-foreground">Pagado</p><p className="font-semibold text-success">{money(r.paid)}</p></div>
              <div><p className="text-xs text-muted-foreground">Debe</p><p className="font-bold text-warning">{money(r.balance)}</p></div>
            </div>
          </CardContent>
        </Card>
      ))}
      <ProviderCrossDetail row={open} onClose={() => setOpen(null)} />
    </div>
  );
}