import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/components/api/ApiQueueManager';

const todayInput = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const toDateInput = (value) => {
  if (!value) return todayInput();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return todayInput();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

// Anotación de entrega de una guía ya emitida: fecha, quién recibe y notas.
export default function DispatchGuideDeliveryDialog({ guide, open, onOpenChange, onSaved }) {
  const [date, setDate] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(toDateInput(guide?.delivered_date));
    setReceivedBy(guide?.received_by || '');
    setNotes(guide?.delivery_notes || '');
  }, [open, guide]);

  const save = async (reset) => {
    if (!guide?.id) return;
    setSaving(true);
    try {
      const me = await base44.auth.me().catch(() => null);
      const marker = {
        delivery_updated_by: me?.email || '',
        delivery_updated_date: new Date().toISOString(),
      };

      if (reset) {
        await base44.entities.DispatchGuide.update(guide.id, {
          dispatch_status: 'emitida',
          delivered_date: '',
          received_by: '',
          delivery_notes: '',
          ...marker,
        });
        toast.success('Entrega deshecha: la guía vuelve a Emitida');
      } else {
        await base44.entities.DispatchGuide.update(guide.id, {
          dispatch_status: 'entregada',
          delivered_date: date ? new Date(`${date}T12:00:00`).toISOString() : new Date().toISOString(),
          received_by: receivedBy.trim(),
          delivery_notes: notes.trim(),
          ...marker,
        });
        toast.success('Entrega anotada en la guía');
      }

      onOpenChange(false);
      onSaved?.();
    } catch (_) {
      toast.error('No se pudo guardar la entrega');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Entrega de la guía {guide?.guide_number || ''}</DialogTitle>
          <DialogDescription>
            Registra cuándo y a quién se entregó la carga de esta guía. Puedes corregirlo después.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Fecha de entrega</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Recibido por</Label>
            <Input
              value={receivedBy}
              onChange={(e) => setReceivedBy(e.target.value)}
              placeholder="Nombre de quien recibe"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Notas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones de la entrega"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          {guide?.dispatch_status === 'entregada' ? (
            <Button variant="ghost" onClick={() => save(true)} disabled={saving} className="text-rose-600">
              <Undo2 className="h-4 w-4" /> Quitar entrega
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={() => save(false)} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar entrega
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}