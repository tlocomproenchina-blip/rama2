import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { downloadShippingLabelFile } from '@/lib/shippingLabelFile';

const EMPTY = { content: '', dimensions: '', weight: '', boxCount: '1', has_fbrand: false, has_battery: false, has_liquid: false, has_powder: false };

const FLAGS = [
  ['has_fbrand', 'F牌 (Réplica)'],
  ['has_battery', '带电 (Batería)'],
  ['has_liquid', '液体 (Líquido)'],
  ['has_powder', '粉末 (Polvo)'],
];

// Soporte crea una etiqueta de envío nueva a nombre del cliente y la descarga.
export default function SupportGenerateLabelDialog({ open, onOpenChange, clientEmail, config, onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const close = (v) => {
    if (busy) return;
    onOpenChange(v);
    if (!v) setForm(EMPTY);
  };

  const submit = async () => {
    if (!form.content.trim()) return toast.error('El contenido es requerido');
    if (!form.weight.trim()) return toast.error('El peso es requerido');
    const boxes = Math.max(1, Number(form.boxCount) || 1);
    setBusy(true);
    try {
      const { data } = await base44.functions.invoke('generateShippingLabel', {
        client_email: clientEmail,
        content: form.content,
        dimensions: form.dimensions,
        weight: form.weight,
        box_count: boxes,
        has_fbrand: form.has_fbrand,
        has_battery: form.has_battery,
        has_liquid: form.has_liquid,
        has_powder: form.has_powder,
      });
      await downloadShippingLabelFile(data.label, config);
      toast.success(`Etiqueta ${data.label.label_code} generada y descargada`);
      onCreated?.();
      setForm(EMPTY);
      onOpenChange(false);
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'No se pudo generar la etiqueta');
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Tag className="h-5 w-5 text-primary" /> Generar etiqueta para el cliente</DialogTitle>
          <DialogDescription>Se crea con el Shipping Mark del cliente y se descarga como archivo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Contenido</Label>
              <Input value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Ej: Ropa, electrónicos..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dimensiones</Label>
              <Input value={form.dimensions} onChange={(e) => setForm({ ...form, dimensions: e.target.value })} placeholder="Ej: 40×30×20 cm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Peso</Label>
              <Input value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="Ej: 5 kg" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nº de cajas</Label>
              <Input type="number" min="1" value={form.boxCount} onChange={(e) => setForm({ ...form, boxCount: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
            {FLAGS.map(([key, text]) => (
              <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={form[key]} onCheckedChange={(v) => setForm({ ...form, [key]: !!v })} />
                {text}
              </label>
            ))}
          </div>
          <Button className="w-full" onClick={submit} disabled={busy}>
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generando...</> : 'Generar y descargar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}