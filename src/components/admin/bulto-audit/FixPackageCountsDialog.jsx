import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

// Corrección del conteo de paquetes ya guardado: recalcula el número real de las cajas y
// bultos creados hasta hoy y limpia las etiquetas de bultos ya fusionados que quedaron
// mezcladas en sus códigos, para que ficha, etiqueta y guía de despacho digan lo mismo.
export default function FixPackageCountsDialog({ open, onClose, onDone }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    setRunning(true);
    try {
      const res = await base44.functions.invoke('fixBultoPackageCounts', {});
      const data = res?.data || res;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setResult(data);
      toast.success(`${data?.corregidos ?? 0} registro(s) corregido(s) de ${data?.revisados ?? 0} revisado(s)`);
      onDone?.();
    } catch (e) {
      toast.error('Error al corregir los conteos: ' + (e?.message || 'desconocido'));
    } finally {
      setRunning(false);
    }
  };

  const close = () => {
    if (running) return;
    setResult(null);
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Corregir conteos de paquetes
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-slate-600">
            Recalcula el número de paquetes de las cajas y bultos creados hasta hoy con el conteo real que hay dentro,
            sin las etiquetas de bultos que ya se fusionaron, para que la ficha, la etiqueta y la guía de despacho
            muestren el mismo número.
          </p>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            No crea ni suelta paquetes y no borra el historial de bultos absorbidos. Puedes ejecutarla más de una vez:
            si ya está todo cuadrado, no cambia nada.
          </div>
          {result && (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Revisados: {result.revisados ?? 0} · Corregidos: {result.corregidos ?? 0}
            </p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={close} disabled={running}>Cerrar</Button>
          <Button onClick={run} disabled={running} className="gap-2">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {running ? 'Corrigiendo…' : 'Corregir ahora'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}