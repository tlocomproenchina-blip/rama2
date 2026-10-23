import React, { useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Boxes, Combine, Loader2, Package, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { realPackageCount } from '@/lib/bultoCounts';
import BluetoothPrinter from './BluetoothPrinter';

// Combinar las unidades seleccionadas en el historial: se elige si la unidad nueva es una
// caja consolidada o un bulto suelto, el servidor crea la unidad con su código nuevo y
// elimina las originales dejando constancia de lo combinado. Al terminar se pregunta si
// se imprime la etiqueta de la unidad nueva (solo esa, no las de las unidades fusionadas).
export default function CombineSelectedDialog({ bultos = [], open, onClose, onCreated, onDone }) {
  const [kind, setKind] = useState('caja');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('form');
  const [created, setCreated] = useState(null);
  const [combinedCount, setCombinedCount] = useState(0);

  const clients = new Set(bultos.map((b) => String(b.client_email || '').toLowerCase()));
  const mixedClients = clients.size > 1;
  const blocked = bultos.find((b) => b.billed_invoice_id || b.status === 'despachado');
  const totalPackages = bultos.reduce((sum, b) => sum + realPackageCount(b), 0);
  const canCombine = bultos.length >= 2 && !mixedClients && !blocked && !busy;

  const close = () => {
    if (busy) return;
    if (step === 'print') {
      reset();
      onDone?.(created);
    } else {
      onClose?.();
    }
  };

  const reset = () => {
    setStep('form');
    setCreated(null);
    setCombinedCount(0);
  };

  const handleCombine = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('combineBultos', {
        bulto_ids: bultos.map((b) => b.id),
        kind,
      });
      const data = res?.data;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      toast.success(`${bultos.length} unidades combinadas en ${data?.bulto?.label_code || 'la unidad nueva'}`);
      if (data?.failed?.length) {
        toast.warning(`No se pudieron eliminar: ${data.failed.join(', ')}`);
      }
      // La fusión ya quedó hecha: el paso siguiente solo pregunta si imprimir la etiqueta nueva.
      setCombinedCount(bultos.length);
      setCreated(data?.bulto || null);
      setStep(data?.bulto ? 'print' : 'form');
      onCreated?.(data?.bulto);
      if (!data?.bulto) onDone?.(null);
    } catch (_) {
      toast.error('No se pudieron combinar las unidades');
    } finally {
      setBusy(false);
    }
  };

  const handlePrinted = async () => {
    if (created?.id) {
      try {
        await base44.functions.invoke('registerBultoPrint', { bulto_id: created.id });
      } catch (_) {}
    }
    reset();
    onDone?.(created);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'print' ? (
              <><CheckCircle2 className="h-5 w-5 text-green-600" /> Unidad nueva creada</>
            ) : (
              <><Combine className="h-5 w-5" /> Combinar {bultos.length} unidades</>
            )}
          </DialogTitle>
        </DialogHeader>

        {step === 'print' ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Se combinaron {combinedCount} unidades en{' '}
              <span className="font-mono">{created?.label_code}</span>. ¿Imprimir la etiqueta de la unidad nueva?
            </p>
            <BluetoothPrinter bultos={created ? [created] : []} onPrinted={handlePrinted} />
            <p className="text-xs text-muted-foreground">
              Solo se imprime la unidad nueva; las etiquetas de las unidades fusionadas no se reimprimen.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border bg-muted/40 p-2">
              {bultos.map((b) => (
                <p key={b.id} className="font-mono text-xs break-all">
                  {b.label_code}
                  <span className="ml-1 font-sans text-muted-foreground">
                    · {realPackageCount(b)} paquete(s)
                  </span>
                </p>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setKind('caja')}
                disabled={busy}
                className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                  kind === 'caja' ? 'border-primary bg-primary/5' : 'border-border/70'
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Boxes className="h-3.5 w-3.5" /> Caja consolidada
                </span>
                <span className="text-[11px] text-muted-foreground">Etiqueta continua -C##</span>
              </button>
              <button
                type="button"
                onClick={() => setKind('bulto')}
                disabled={busy}
                className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                  kind === 'bulto' ? 'border-primary bg-primary/5' : 'border-border/70'
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Package className="h-3.5 w-3.5" /> Bulto suelto
                </span>
                <span className="text-[11px] text-muted-foreground">Etiqueta individual -B##</span>
              </button>
            </div>

            {mixedClients && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Solo se pueden combinar unidades del mismo cliente.
              </p>
            )}
            {!mixedClients && blocked && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {blocked.label_code} ya está facturada o despachada. Quítala de la selección para combinar.
              </p>
            )}
            {!mixedClients && !blocked && (
              <p className="text-xs text-muted-foreground">
                {totalPackages} paquete(s) pasarán a la unidad nueva. Las {bultos.length} originales se eliminan.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 'print' ? (
            <Button variant="outline" onClick={() => { reset(); onDone?.(created); }} className="w-full">
              No imprimir
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
              <Button onClick={handleCombine} disabled={!canCombine}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Combine className="h-4 w-4" />}
                Combinar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}