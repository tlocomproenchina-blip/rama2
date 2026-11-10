import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, X } from 'lucide-react';
import FileUploadField from './FileUploadField';
import { money } from '@/lib/providerInvoicesApi';

export const emptyLine = () => ({ invoice_code: '', cbm: '', file: '', expenses: [{ description: '', amount: '' }] });
export const lineOther = (l) => l.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
export const lineTotal = (l, rate) => (Number(rate) || 0) * (Number(l.cbm) || 0) + lineOther(l);
export const linePayload = (l, client, loadDate) => ({
  invoice_code: l.invoice_code, load_date: loadDate, cbm: Number(l.cbm),
  shipping_mark: client.shipping_mark, client_name: client.full_name, client_email: client.email,
  other_expenses: l.expenses, invoice_file_url: l.file,
});

export default function InvoiceLineFields({ line, onChange, onRemove, rate, index }) {
  const set = (k, v) => onChange({ ...line, [k]: v });
  const setExp = (i, k, v) => set('expenses', line.expenses.map((e, j) => (j === i ? { ...e, [k]: v } : e)));
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="font-display font-semibold">Factura {index + 1}</p>
        {onRemove && <Button type="button" variant="ghost" size="icon" onClick={onRemove}><X /></Button>}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2"><Label>Código de factura</Label><Input required value={line.invoice_code} onChange={(e) => set('invoice_code', e.target.value)} /></div>
        <div className="space-y-2"><Label>CBM</Label><Input type="number" step="0.0001" min="0" required value={line.cbm} onChange={(e) => set('cbm', e.target.value)} /></div>
      </div>
      <div className="space-y-2">
        <Label>Otros gastos</Label>
        {line.expenses.map((x, i) => (
          <div key={i} className="flex gap-2">
            <Input placeholder="Descripción" value={x.description} onChange={(e) => setExp(i, 'description', e.target.value)} />
            <Input className="w-36" type="number" step="0.01" placeholder="Monto" value={x.amount} onChange={(e) => setExp(i, 'amount', e.target.value)} />
            <Button type="button" variant="ghost" size="icon" onClick={() => set('expenses', line.expenses.filter((_, j) => j !== i))}><Trash2 /></Button>
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={() => set('expenses', [...line.expenses, { description: '', amount: '' }])}><Plus /> Agregar gasto</Button>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2"><Label>Factura (foto o PDF)</Label><FileUploadField value={line.file} onChange={(v) => set('file', v)} /></div>
        <p className="text-sm text-muted-foreground">{money(rate)} × {Number(line.cbm) || 0} + {money(lineOther(line))} = <b className="text-primary">{money(lineTotal(line, rate))}</b></p>
      </div>
    </div>
  );
}