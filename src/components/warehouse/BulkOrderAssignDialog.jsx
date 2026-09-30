import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Hash, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/components/api/ApiQueueManager';
import { getAll, put } from '@/lib/offlineDb';

// Escribe uno o varios N° de orden (separados por coma) en varios bultos a la vez.
// - Los bultos que aún viven en el dispositivo se corrigen aquí y en su cola de
//   sincronización, para que suban con el número ya puesto.
// - Los bultos registrados se corrigen por el servidor (updateBulto), que además
//   alinea el recibo de contabilidad.
// - Un N° de orden ya asignado por un empleado (bloqueado) no se sobrescribe.
const parseOrders = (raw) => String(raw || '').split(/[,\n;]/).map((s) => s.trim()).filter(Boolean);

export default function BulkOrderAssignDialog({ bultos = [], open, onClose, onDone }) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const locked = bultos.filter((b) => b.order_locked);
  const assignable = bultos.filter((b) => !b.order_locked);

  const handleSave = async () => {
    const orders = parseOrders(value);
    if (!orders.length) {
      toast.error('Escribe al menos un N° de orden');
      return;
    }
    if (!assignable.length) {
      toast.error('Los bultos seleccionados tienen el N° de orden bloqueado por un empleado');
      return;
    }
    setSaving(true);
    let ok = 0;
    const failed = [];
    for (const b of assignable) {
      try {
        const isLocal = b.is_local_pending || String(b.id).startsWith('local_');
        if (isLocal) {
          await put('bultos', { ...b, cbm_order_numbers: orders });
          const queue = await getAll('sync_queue');
          const item = queue.find((q) => q.id === b.id);
          if (item) await put('sync_queue', { ...item, cbm_order_numbers: orders });
        } else {
          const res = await base44.functions.invoke('updateBulto', {
            bulto_id: b.id,
            cbm_order_numbers: orders,
          });
          if (res?.data?.error) throw new Error(res.data.error);
        }
        ok++;
      } catch (_) {
        failed.push(b.label_code || b.id);
      }
    }
    setSaving(false);
    if (failed.length) {
      toast.warning(`${ok} bulto(s) actualizado(s). Fallaron: ${failed.join(', ')}`);
    } else {
      toast.success(ok === 1 ? 'N° de orden actualizado' : `N° de orden actualizado en ${ok} bultos`);
    }
    setValue('');
    onDone?.();
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose?.()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-blue-600" /> N° de orden para {bultos.length} bulto(s)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600">N° de orden / envío</Label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Ej: 12345 o 12345, 67890"
              autoFocus
            />
            <p className="text-xs text-slate-500">
              Se aplica a todos los bultos seleccionados. Puedes escribir varios separados por coma.
            </p>
          </div>

          <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-muted/30 p-2 space-y-0.5">
            {bultos.map((b) => (
              <p key={b.id} className="font-mono text-xs break-all text-slate-600">
                {b.label_code}
                {b.order_locked && <span className="ml-2 font-sans text-amber-700">· bloqueado</span>}
              </p>
            ))}
          </div>

          {locked.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {locked.length} bulto(s) tienen el N° de orden asignado y bloqueado por un empleado: no se
                cambiarán. Para corregirlos, un admin debe desbloquearlos desde la edición del bulto.
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onClose?.()} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !assignable.length} className="bg-blue-600 hover:bg-blue-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hash className="h-4 w-4" />}
            Aplicar a {assignable.length || 0}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}