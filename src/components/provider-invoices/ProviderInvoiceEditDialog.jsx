import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import ProviderClientSearch from './ProviderClientSearch';
import InvoiceLineFields, { emptyLine, lineTotal, linePayload } from './InvoiceLineFields';
import { piCall, money } from '@/lib/providerInvoicesApi';

export default function ProviderInvoiceEditDialog({ inv, open, onOpenChange, onSaved }) {
  const [client, setClient] = useState({ email: inv.client_email, shipping_mark: inv.shipping_mark, full_name: inv.client_name });
  const [loadDate, setLoadDate] = useState(inv.load_date || '');
  const [main, setMain] = useState({
    invoice_code: inv.invoice_code || '', cbm: inv.cbm ?? '', file: inv.invoice_file_url || '',
    expenses: (inv.other_expenses || []).length ? inv.other_expenses : [{ description: '', amount: '' }],
  });
  const [extra, setExtra] = useState([]);
  const [saving, setSaving] = useState(false);
  const total = lineTotal(main, inv.flat_rate) + extra.reduce((s, l) => s + lineTotal(l, inv.flat_rate), 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!client?.shipping_mark) return toast.error('Selecciona un cliente');
    setSaving(true);
    try {
      await piCall('update', { id: inv.id, data: linePayload(main, client, loadDate) });
      for (const l of extra) await piCall('create', { data: linePayload(l, client, loadDate) });
      toast.success(extra.length ? `Factura actualizada y ${extra.length} agregada(s)` : 'Factura actualizada');
      onOpenChange(false); onSaved?.();
    } catch (err) { toast.error(err?.response?.data?.error || 'No se pudo guardar'); onSaved?.(); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">Editar factura {inv.invoice_code}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2"><Label>Cliente (Shipping Mark)</Label><ProviderClientSearch value={client} onChange={setClient} /></div>
          <div className="space-y-2"><Label>Fecha de carga (para todo el grupo)</Label><Input type="date" value={loadDate} onChange={(e) => setLoadDate(e.target.value)} /></div>
          <InvoiceLineFields index={0} line={main} rate={inv.flat_rate} onChange={setMain} />
          {extra.map((l, i) => (
            <InvoiceLineFields key={i} index={i + 1} line={l} rate={inv.flat_rate}
              onChange={(v) => setExtra(extra.map((x, j) => (j === i ? v : x)))}
              onRemove={() => setExtra(extra.filter((_, j) => j !== i))} />
          ))}
          <Button type="button" variant="outline" onClick={() => setExtra([...extra, emptyLine()])}><Plus /> Agregar factura y CBM</Button>
          <div className="rounded-xl bg-accent/60 p-4 text-sm">
            <p>{1 + extra.length} factura(s) · Tarifa {money(inv.flat_rate)}</p>
            <p className="mt-1 font-display text-2xl font-bold text-primary">{money(total)}</p>
          </div>
          <Button type="submit" disabled={saving}>{saving && <Loader2 className="animate-spin" />}Guardar cambios</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}