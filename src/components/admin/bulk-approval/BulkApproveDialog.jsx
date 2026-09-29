import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCheck, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

// Confirmación de la aprobación masiva: resumen (cantidad + monto), progreso y resultado final.
export default function BulkApproveDialog({ open, onOpenChange, ids, type, label, amount, amountLabel, onDone }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const count = ids?.length || 0;
  const total = Number(amount || 0);

  const close = () => {
    if (running) return;
    setResult(null);
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    setRunning(true);
    try {
      const res = await base44.functions.invoke('bulkApprovePayments', { type, ids });
      const data = res?.data || {};
      if (!data.success) {
        toast.error(data.error || 'No se pudo aprobar en bloque');
      } else {
        setResult(data);
        if (data.failed_count > 0) {
          toast.warning(`${data.approved_count} aprobados · ${data.failed_count} con error`);
        } else {
          toast.success(`${data.approved_count} aprobados correctamente`);
        }
        await onDone?.(data.approved || []);
      }
    } catch (e) {
      toast.error('No se pudo aprobar en bloque');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
              <p className="text-3xl font-bold text-emerald-700">{result.approved_count}</p>
              <p className="text-sm text-emerald-800">aprobados correctamente</p>
            </div>
            {result.failed_count > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                  <AlertTriangle className="h-4 w-4" /> {result.failed_count} quedaron pendientes
                </p>
                <ul className="mt-2 space-y-1 text-xs text-amber-800">
                  {(result.failed || []).slice(0, 5).map((f) => (
                    <li key={f.id} className="truncate">• {f.error}</li>
                  ))}
                  {result.failed_count > 5 && <li>• y {result.failed_count - 5} más</li>}
                </ul>
              </div>
            )}
            <DialogFooter>
              <Button onClick={close} className="w-full sm:w-auto">Cerrar</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border bg-muted/40 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Registros a aprobar</span>
                <span className="font-semibold">{count}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-muted-foreground">{amountLabel || 'Monto total'}</span>
                <span className="font-semibold">${total.toFixed(2)}</span>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Se aprueban los {count} registros que estás viendo en pantalla. Esta acción no se puede deshacer.
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={close} disabled={running} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={running}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
              >
                {running ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Procesando {count}...</>
                ) : (
                  <><CheckCheck className="h-4 w-4 mr-1" /> Aprobar en bloque</>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}