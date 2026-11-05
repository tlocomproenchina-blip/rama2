import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, PackageOpen, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import DismantleResult from './DismantleResult';

// Confirmación y resultado de desarmar una caja o bulto que absorbió otros bultos.
export default function DismantleCajaDialog({ caja, onClose, onDone }) {
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState(null);
  const absorbed = Array.isArray(caja?.absorbed_bultos) ? caja.absorbed_bultos : [];
  const warnings = [
    caja?.status === 'despachado' && 'Está marcada como despachada.',
    caja?.billed_invoice_id && 'Está incluida en una factura.',
  ].filter(Boolean);

  const confirm = async () => {
    setWorking(true);
    const res = await base44.functions.invoke('desarmarCaja', { bulto_id: caja.id })
      .catch((e) => e?.response || { data: { error: e?.message } });
    setWorking(false);
    if (res?.data?.error) {
      toast.error(res.data.error);
      return;
    }
    setResult(res.data);
    onDone?.();
  };

  return (
    <Dialog open={!!caja} onOpenChange={(o) => !o && !working && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Desarmar {caja?.label_code}</DialogTitle>
        </DialogHeader>
        {result ? (
          <DismantleResult result={result} />
        ) : (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Se restaurarán <strong className="text-foreground">{absorbed.length}</strong> unidad(es) desde el historial guardado:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {absorbed.map((a, i) => (
                <span key={i} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                  {a.label_code || 'sin etiqueta'} · {a.package_count ?? (a.trackings || []).length} paq.
                </span>
              ))}
            </div>
            <p>
              {caja?.label_code} no se borra: queda como registro histórico. Si se queda sin contenido pasa a «Desarmado».
              Las guías y facturas ya emitidas no se modifican.
            </p>
            {warnings.length > 0 && (
              <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{warnings.join(' ')} Los bultos restaurados heredan su estado.</span>
              </div>
            )}
          </div>
        )}
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {result ? (
            <Button onClick={onClose}>Listo</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={working}>Cancelar</Button>
              <Button onClick={confirm} disabled={working} className="bg-amber-600 hover:bg-amber-700">
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageOpen className="h-4 w-4" />} Desarmar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}