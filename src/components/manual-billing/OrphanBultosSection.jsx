import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Boxes } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import useOrphanBultos from '@/hooks/useOrphanBultos';
import BultosReceiptDialog from './BultosReceiptDialog';
import { assignBultosToReceipt, bultoCbm, bultoPackages, createReceiptFromBultos } from '@/lib/receiptFromBultos';

// Bultos en almacén sin recibo ni factura: se seleccionan y se agrupan en un recibo del cliente.
export default function OrphanBultosSection({ client, version, onCreated }) {
  const { items, reload } = useOrphanBultos(client, version);
  const [selected, setSelected] = useState(new Set());
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  if (!items.length) return null;
  const chosen = items.filter((b) => selected.has(b.id));
  const toggle = (id) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const confirm = ({ invoiceNumber, cbm }) => run(async () => {
    await createReceiptFromBultos({ client, bultoIds: chosen.map((b) => b.id), invoiceNumber, cbm });
    return `Recibo ${invoiceNumber.trim()} creado con ${chosen.length} bulto(s)`;
  });

  const assign = (receiptId) => run(async () => {
    const r = await assignBultosToReceipt({ client, bultoIds: chosen.map((b) => b.id), receiptId });
    return `${chosen.length} bulto(s) asignados al recibo ${r.invoice_number}`;
  });

  const run = async (action) => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    try {
      toast.success(await action());
      setOpen(false);
      setSelected(new Set());
      await reload();
      onCreated?.();
    } catch (e) {
      toast.error(e?.message || 'No se pudo guardar el recibo');
      reload();
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-primary/25 bg-accent/40 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-display text-sm font-semibold text-foreground">Bultos en almacén sin recibo ni factura ({items.length})</p>
          <p className="text-xs text-muted-foreground">Selecciona los bultos para agruparlos en un recibo del cliente.</p>
        </div>
        <Button size="sm" disabled={!chosen.length} onClick={() => setOpen(true)}>Crear recibo ({chosen.length})</Button>
      </div>
      {items.map((b) => (
        <label key={b.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
          <Checkbox checked={selected.has(b.id)} onCheckedChange={() => toggle(b.id)} />
          <Boxes className="h-4 w-4 text-primary shrink-0" />
          <span className="font-semibold text-foreground">{b.label_code || 'Sin etiqueta'}</span>
          <span className="text-xs text-muted-foreground">{bultoPackages(b)} paq · {bultoCbm(b) > 0 ? `${bultoCbm(b)} CBM` : 'sin CBM'}{(b.cbm_order_numbers || []).length ? ` · ${b.cbm_order_numbers.join(', ')}` : ''}</span>
        </label>
      ))}
      <BultosReceiptDialog open={open} onOpenChange={setOpen} bultos={chosen} saving={saving} onConfirm={confirm} onAssign={assign} clientEmail={client?.email} />
    </div>
  );
}