import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Truck, Warehouse } from 'lucide-react';
import { toast } from 'sonner';

const OPTIONS = [
  { value: 'retiro_almacen', icon: Warehouse, title: 'Retirar en almacén Valencia', text: 'Pasas a buscar tu carga por nuestro almacén en Valencia.' },
  { value: 'puerta_a_puerta', icon: Truck, title: 'Recibirlo en la puerta de tu casa', text: 'Llevamos tu carga hasta tu dirección registrada.' },
];

export default function DeliveryChoiceDialog({ invoice, open, onClose, onChosen }) {
  const [option, setOption] = useState('');
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke('chooseInvoiceDelivery', { invoice_id: invoice.id, option });
      onChosen(res.data.invoice);
    } catch (e) {
      toast.error(e?.response?.data?.error || 'No se pudo guardar tu elección. Intenta de nuevo.');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>¿Cómo quieres recibir tu carga?</DialogTitle>
          <DialogDescription>Según tu elección calculamos el monto a pagar de la factura {invoice?.invoice_number}. Esta elección no se puede cambiar después.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {OPTIONS.map(({ value, icon: Icon, title, text }) => (
            <button key={value} type="button" onClick={() => setOption(value)}
              className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors ${option === value ? 'border-primary bg-accent' : 'border-border hover:border-primary/50'}`}>
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span><span className="block font-semibold text-slate-900">{title}</span><span className="text-sm text-slate-500">{text}</span></span>
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={confirm} disabled={!option || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Continuar al pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}