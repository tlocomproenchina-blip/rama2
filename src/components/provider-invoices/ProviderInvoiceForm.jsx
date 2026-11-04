import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import ProviderClientSearch from './ProviderClientSearch';
import FileUploadField from './FileUploadField';
import { piCall, money } from '@/lib/providerInvoicesApi';

const empty = { invoice_code: '', load_date: '', cbm: '', file: '', expenses: [{ description: '', amount: '' }] };

export default function ProviderInvoiceForm({ flatRate, onCreated }) {
  const [client, setClient] = useState(null);
  const [f, setF] = useState(empty);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setExp = (i, k, v) => set('expenses', f.expenses.map((e, j) => (j === i ? { ...e, [k]: v } : e)));
  const other = f.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const total = flatRate * (Number(f.cbm) || 0) + other;

  const submit = async (e) => {
    e.preventDefault();
    if (!client) return toast.error('Selecciona un cliente');
    setSaving(true);
    try {
      await piCall('create', { data: {
        invoice_code: f.invoice_code, load_date: f.load_date, cbm: Number(f.cbm),
        shipping_mark: client.shipping_mark, client_name: client.full_name, client_email: client.email,
        other_expenses: f.expenses, invoice_file_url: f.file,
      } });
      toast.success('Factura creada');
      setF(empty); setClient(null); onCreated?.();
    } catch (err) { toast.error(err?.response?.data?.error || 'No se pudo crear'); }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader><CardTitle className="font-display">Nueva factura de proveedor</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2"><Label>Cliente (Shipping Mark)</Label><ProviderClientSearch value={client} onChange={setClient} /></div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2"><Label>Código de factura (contenedor)</Label><Input required value={f.invoice_code} onChange={(e) => set('invoice_code', e.target.value)} /></div>
            <div className="space-y-2"><Label>Fecha de carga</Label><Input type="date" required value={f.load_date} onChange={(e) => set('load_date', e.target.value)} /></div>
            <div className="space-y-2"><Label>CBM</Label><Input type="number" step="0.0001" min="0" required value={f.cbm} onChange={(e) => set('cbm', e.target.value)} /></div>
          </div>
          <div className="space-y-2">
            <Label>Otros gastos</Label>
            {f.expenses.map((x, i) => (
              <div key={i} className="flex gap-2">
                <Input placeholder="Descripción" value={x.description} onChange={(e) => setExp(i, 'description', e.target.value)} />
                <Input className="w-36" type="number" step="0.01" placeholder="Monto" value={x.amount} onChange={(e) => setExp(i, 'amount', e.target.value)} />
                <Button type="button" variant="ghost" size="icon" onClick={() => set('expenses', f.expenses.filter((_, j) => j !== i))}><Trash2 /></Button>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => set('expenses', [...f.expenses, { description: '', amount: '' }])}><Plus /> Agregar gasto</Button>
          </div>
          <div className="space-y-2"><Label>Factura (foto o PDF)</Label><FileUploadField value={f.file} onChange={(v) => set('file', v)} /></div>
          <div className="rounded-xl bg-accent/60 p-4 text-sm">
            <p>Tarifa plana: <b>{money(flatRate)}</b> × CBM {Number(f.cbm) || 0} + otros {money(other)}</p>
            <p className="mt-1 font-display text-2xl font-bold text-primary">{money(total)}</p>
          </div>
          <Button type="submit" disabled={saving || !flatRate}>{saving && <Loader2 className="animate-spin" />}Crear factura</Button>
          {!flatRate && <p className="text-sm text-destructive">El administrador debe configurar la tarifa plana.</p>}
        </form>
      </CardContent>
    </Card>
  );
}