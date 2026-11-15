import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2, Receipt } from 'lucide-react';
import { lineAmounts, money } from '@/lib/wholesalerScope';
import WholesalerClientSearch from './WholesalerClientSearch';
import WholesalerInvoiceLine from './WholesalerInvoiceLine';

// Factura manual: buscar clientes del mayorista, cargar CBM y paquetes, revisar
// el desglose con las tarifas de configuración y emitir.
export default function WholesalerManualInvoiceForm({ connection, preselect, onEmitted }) {
  const [lines, setLines] = useState([]);
  const [notes, setNotes] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [saving, setSaving] = useState(false);
  const key = connection.config_key || 'main';
  const rates = { rate_per_cbm: connection.rate_per_cbm, door_to_door_per_cbm: connection.door_to_door_per_cbm, handling_fee: 1 };

  const add = (client) => setLines((prev) => (prev.some((l) => l.client.id === client.id) ? prev : [...prev, { client, cbm: '', packages: '' }]));
  useEffect(() => { setLines(preselect && (preselect.wholesaler_key || 'main') === key ? [{ client: preselect, cbm: '', packages: '' }] : []); }, [key]);
  useEffect(() => { if (preselect) add(preselect); }, [preselect?.id]);

  const total = useMemo(() => lines.reduce((s, l) => s + lineAmounts(l.cbm, l.packages, rates).total, 0), [lines, connection]);

  const emit = async () => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke('wholesalerManualInvoice', {
        wholesaler_key: key,
        notes,
        send_email: sendEmail,
        items: lines.map((l) => ({ client_id: l.client.id, cbm: Number(String(l.cbm).replace(',', '.')) || 0, packages: Number(l.packages) || 0 })),
      });
      toast.success(`Factura ${res.data.invoice_number} emitida por ${money(res.data.totals.total)}`);
      setLines([]); setNotes('');
      onEmitted?.();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'No se pudo emitir la factura.');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-accent px-3 py-1 font-semibold text-accent-foreground">Envío {money(rates.rate_per_cbm)}/CBM</span>
        <span className="rounded-full bg-accent px-3 py-1 font-semibold text-accent-foreground">Puerta a puerta {money(rates.door_to_door_per_cbm)}/CBM</span>
        <span className="rounded-full bg-accent px-3 py-1 font-semibold text-accent-foreground">Manejo {money(1)}/paquete</span>
      </div>
      <WholesalerClientSearch wholesalerKey={key} onPick={add} />
      {!lines.length && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Busca y agrega los clientes que vas a facturar.</p>}
      <div className="space-y-3">
        {lines.map((l, i) => (
          <WholesalerInvoiceLine key={l.client.id} line={l} rates={rates}
            onChange={(patch) => setLines(lines.map((x, j) => (j === i ? { ...x, ...patch } : x)))}
            onRemove={() => setLines(lines.filter((_, j) => j !== i))} />
        ))}
      </div>
      {lines.length > 0 && (
        <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-card">
          <div className="space-y-1.5"><Label>Notas (opcional)</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={sendEmail} onCheckedChange={setSendEmail} /> Enviar al correo del mayorista ({connection.invoice_email || 'sin correo'})</label>
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-xl font-bold">Total: {money(total)} USD</p>
            <Button onClick={emit} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Receipt />} Emitir factura</Button>
          </div>
        </div>
      )}
    </div>
  );
}