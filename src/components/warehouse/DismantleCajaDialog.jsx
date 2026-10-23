import React, { useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, PackageOpen } from 'lucide-react';
import { toast } from 'sonner';

// Desarmar una caja consolidada del historial: sus bultos originales vuelven a existir
// (disponibles otra vez para el cliente) y la caja se elimina. El servidor reconstruye
// cada unidad desde el detalle guardado en absorbed_bultos.
export default function DismantleCajaDialog({ bulto, open, onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const originals = Array.isArray(bulto?.absorbed_bultos) ? bulto.absorbed_bultos : [];

  const handleDismantle = async () => {
    if (!bulto?.id) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke('desarmarCaja', { bulto_id: bulto.id });
      const data = res?.data;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      toast.success(
        `${data?.restored_count || 0} bulto(s) devueltos al cliente. La caja ${data?.caja_label || ''} fue eliminada.`
      );
      if (data?.failed?.length) {
        toast.warning(`No se pudieron restaurar: ${data.failed.join(', ')}`);
      }
      onDone?.(data);
    } catch (_) {
      toast.error('No se pudo desarmar la caja');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose?.()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageOpen className="h-5 w-5" /> Desarmar caja {bulto?.label_code || ''}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-border bg-muted/40 p-2">
            {originals.length ? originals.map((entry, index) => (
              <p key={`${entry.label_code || 'bulto'}-${index}`} className="font-mono text-xs break-all">
                {entry.label_code || 'Sin etiqueta'}
                <span className="ml-1 font-sans text-muted-foreground">
                  · {Number(entry.package_count) || 0} paquete(s)
                </span>
              </p>
            )) : (
              <p className="text-xs text-muted-foreground">
                Esta caja no tiene el detalle de sus bultos originales.
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Los bultos originales vuelven a quedar disponibles para el cliente y la caja se elimina.
            Si alguna etiqueta ya está ocupada por otro bulto, se le asigna una nueva.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button
            onClick={handleDismantle}
            disabled={busy || !originals.length}
            className="bg-red-600 hover:bg-red-700"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageOpen className="h-4 w-4" />}
            Desarmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}