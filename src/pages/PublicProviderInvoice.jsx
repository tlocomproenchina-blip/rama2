import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, FileText, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { piCall, money } from '@/lib/providerInvoicesApi';

export default function PublicProviderInvoice() {
  const { token } = useParams();
  const [inv, setInv] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => { piCall('public', { token }).then((d) => setInv(d.invoice)).catch(() => setMissing(true)); }, [token]);
  useEffect(() => {
    if (!missing) return;
    const m = document.createElement('meta'); m.name = 'prerender-status-code'; m.content = '404';
    document.head.appendChild(m); return () => m.remove();
  }, [missing]);

  if (missing) return <p className="py-20 text-center text-muted-foreground">Factura no encontrada.</p>;
  if (!inv) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  const paid = inv.status === 'pagada';

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-3xl border bg-card p-6 shadow-premium md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">IMPORTADORA TLEC CARGO · Factura de proveedor</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-bold">{inv.invoice_code}</h1>
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${paid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-800'}`}>{paid ? 'Pagada' : 'No pagada'}</span>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-muted-foreground">Cliente</dt><dd className="font-semibold">{inv.shipping_mark}</dd></div>
          <div><dt className="text-muted-foreground">Fecha de carga</dt><dd className="font-semibold">{inv.load_date || '—'}</dd></div>
          <div><dt className="text-muted-foreground">Tarifa plana</dt><dd className="font-semibold">{money(inv.flat_rate)}</dd></div>
          <div><dt className="text-muted-foreground">CBM</dt><dd className="font-semibold">{inv.cbm}</dd></div>
        </dl>
        {(inv.other_expenses || []).length > 0 && (
          <div className="mt-6 space-y-1 text-sm">
            <p className="text-muted-foreground">Otros gastos</p>
            {inv.other_expenses.map((e, i) => <div key={i} className="flex justify-between"><span>{e.description}</span><span>{money(e.amount)}</span></div>)}
          </div>
        )}
        <div className="mt-6 flex items-center justify-between rounded-2xl bg-accent/60 p-4">
          <span className="text-sm">Total</span><span className="font-display text-2xl font-bold text-primary">{money(inv.total)}</span>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {inv.invoice_file_url && <Button variant="outline" asChild><a href={inv.invoice_file_url} target="_blank" rel="noreferrer"><FileText />Ver factura</a></Button>}
          {inv.payment_proof_url && <Button variant="outline" asChild><a href={inv.payment_proof_url} target="_blank" rel="noreferrer"><CheckCircle2 />Comprobante de pago</a></Button>}
        </div>
      </div>
    </div>
  );
}