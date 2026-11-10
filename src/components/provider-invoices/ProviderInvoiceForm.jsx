import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import ProviderClientSearch from './ProviderClientSearch';
import InvoiceLineFields, { emptyLine, lineTotal, linePayload } from './InvoiceLineFields';
import { piCall, money } from '@/lib/providerInvoicesApi';

export default function ProviderInvoiceForm({ flatRate, onCreated }) {
  const [client, setClient] = useState(null);
  const [loadDate, setLoadDate] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const total = lines.reduce((s, l) => s + lineTotal(l, flatRate), 0);
  const cbm = lines.reduce((s, l) => s + (Number(l.cbm) || 0), 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!client) return toast.error('Selecciona un cliente');
    setSaving(true);
    let done = 0;
    try {
      for (const l of lines) { await piCall('create', { data: linePayload(l, client, loadDate) }); done++; }
      toast.success(`${done} factura(s) creada(s)`);
      setLines([emptyLine()]); setClient(null); setLoadDate('');
    } catch (err) {
      toast.error(`${done} creada(s). Error: ${err?.response?.data?.error || 'No se pudo crear'}`);
      setLines(lines.slice(done));
    }
    if (done) onCreated?.();
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader><CardTitle className="font-display">Nuevas facturas de proveedor</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
            <div className="space-y-2"><Label>Cliente (Shipping Mark)</Label><ProviderClientSearch value={client} onChange={setClient} /></div>
            <div className="space-y-2"><Label>Fecha de carga (para todo el grupo)</Label><Input type="date" required value={loadDate} onChange={(e) => setLoadDate(e.target.value)} /></div>
          </div>
          {lines.map((l, i) => (
            <InvoiceLineFields key={i} index={i} line={l} rate={flatRate}
              onChange={(v) => setLines(lines.map((x, j) => (j === i ? v : x)))}
              onRemove={lines.length > 1 ? () => setLines(lines.filter((_, j) => j !== i)) : null} />
          ))}
          <Button type="button" variant="outline" onClick={() => setLines([...lines, emptyLine()])}><Plus /> Agregar factura y CBM</Button>
          <div className="rounded-xl bg-accent/60 p-4 text-sm">
            <p>{lines.length} factura(s) · {cbm.toFixed(4)} CBM · Tarifa {money(flatRate)}</p>
            <p className="mt-1 font-display text-2xl font-bold text-primary">{money(total)}</p>
          </div>
          <Button type="submit" disabled={saving || !flatRate}>{saving && <Loader2 className="animate-spin" />}Crear facturas</Button>
          {!flatRate && <p className="text-sm text-destructive">El administrador debe configurar la tarifa plana.</p>}
        </form>
      </CardContent>
    </Card>
  );
}