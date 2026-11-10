import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Link2, ExternalLink, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import ProviderInvoiceRowActions from './ProviderInvoiceRowActions';
import { piCall, money, publicInvoiceUrl } from '@/lib/providerInvoicesApi';

export default function ProviderInvoiceRow({ inv, isAdmin, onChanged, selected, onToggle, onPay }) {
  const [busy, setBusy] = useState(false);
  const paid = inv.status === 'pagada';

  const copy = async () => { await navigator.clipboard.writeText(publicInvoiceUrl(inv.public_token)); toast.success('Enlace copiado'); };
  const markUnpaid = async () => {
    setBusy(true);
    try { await piCall('markPaid', { id: inv.id, paid: false }); onChanged?.(); }
    catch (err) { toast.error(err?.response?.data?.error || 'Error'); }
    setBusy(false);
  };

  return (
    <div className={`rounded-2xl border bg-card p-4 shadow-card transition ${selected ? 'border-primary ring-2 ring-primary/20' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Checkbox className="mt-1.5" checked={!!selected} onCheckedChange={onToggle} />
          <div>
            <p className="font-display text-lg font-semibold">{inv.invoice_code}</p>
            <p className="text-sm text-muted-foreground">{inv.shipping_mark} · {inv.client_name} · Carga {inv.load_date || '—'}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display text-xl font-bold">{money(inv.total)}</p>
          <Badge className={paid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-800'}>{paid ? 'Pagada' : 'No pagada'}</Badge>
          {paid && inv.paid_date && <p className="mt-1 text-xs text-muted-foreground">Pago {String(inv.paid_date).slice(0, 10)}</p>}
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{money(inv.flat_rate)} × {inv.cbm} CBM + otros {money(inv.other_total)}
        {(inv.other_expenses || []).length > 0 && ` (${inv.other_expenses.map((e) => `${e.description}: ${money(e.amount)}`).join(', ')})`}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {inv.invoice_file_url && <Button variant="outline" size="sm" asChild><a href={inv.invoice_file_url} target="_blank" rel="noreferrer"><FileText />Factura</a></Button>}
        {inv.payment_proof_url && <Button variant="outline" size="sm" asChild><a href={inv.payment_proof_url} target="_blank" rel="noreferrer"><CheckCircle2 />Comprobante</a></Button>}
        <Button variant="outline" size="sm" asChild><a href={publicInvoiceUrl(inv.public_token)} target="_blank" rel="noreferrer"><ExternalLink />Ver enlace público</a></Button>
        <Button variant="outline" size="sm" onClick={copy}><Link2 />Copiar enlace</Button>
        <ProviderInvoiceRowActions inv={inv} onChanged={onChanged} />
        {isAdmin && (paid
          ? <Button size="sm" variant="outline" onClick={markUnpaid} disabled={busy}>{busy && <Loader2 className="animate-spin" />}Marcar no pagada</Button>
          : <Button size="sm" onClick={onPay}><CheckCircle2 />Marcar pagada</Button>)}
      </div>
    </div>
  );
}