import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { fetchAllPaginated } from '@/lib/fetchAllPaginated';
import { loadProviderCostMap, summarizeProfit } from '@/lib/invoiceProfit';

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Ingresos de facturas pagadas (por fecha de pago) vs. costo real del proveedor.
export default function RealProfitPanel({ fromIso, toIso, title = 'Beneficio real' }) {
  const [t, setT] = useState(null);

  useEffect(() => {
    let active = true;
    setT(null);
    const query = { status: 'pagada' };
    if (fromIso || toIso) query.payment_date = { ...(fromIso && { $gte: fromIso }), ...(toIso && { $lt: toIso }) };
    Promise.all([fetchAllPaginated('Invoice', { method: 'filter', query }), loadProviderCostMap()])
      .then(([invs, map]) => { if (active) setT(summarizeProfit(invs, map)); });
    return () => { active = false; };
  }, [fromIso, toIso]);

  const items = t && [
    { label: 'Ingresos (facturas pagadas)', value: t.revenue, cls: 'text-success', sub: `${t.count} factura(s)` },
    { label: 'Costo pagado al proveedor', value: t.costPaid, cls: 'text-foreground', sub: 'Abonos registrados' },
    { label: 'Costo pendiente proveedor', value: t.costPending, cls: 'text-warning', sub: 'Saldo por pagar (aparte)' },
    { label: 'Beneficio', value: t.profit, cls: t.profit >= 0 ? 'text-success' : 'text-destructive', sub: 'Ingresos − costo pagado' },
  ];

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {!t ? <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {items.map((i) => (
            <Card key={i.label} className="border-0 shadow-card">
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">{i.label}</p>
                <p className={`mt-1 font-display text-2xl font-bold ${i.cls}`}>{fmt(i.value)}</p>
                <p className="text-xs text-muted-foreground">{i.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}