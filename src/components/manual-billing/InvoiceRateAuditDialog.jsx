import React, { useCallback, useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { base44 } from '@/components/api/ApiQueueManager';
import { toast } from 'sonner';
import { Calculator, Loader2 } from 'lucide-react';
import InvoiceRateAuditSummary from './InvoiceRateAuditSummary';
import InvoiceRateAuditGroup from './InvoiceRateAuditGroup';

// Revisión de las tarifas de todas las facturas manuales: compara cada línea de envío
// con la tarifa que le corresponde y corrige solas las facturas que se pueden
// reconstruir con certeza.
export default function InvoiceRateAuditDialog({ open, onOpenChange }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const run = useCallback(async () => {
    setRunning(true);
    try {
      const res = await base44.functions.invoke('auditManualInvoiceRates', { apply: true });
      const data = res?.data || {};
      if (data.error) {
        toast.error(data.error);
      } else {
        setResult(data);
        if (data.summary?.corrected) toast.success(`${data.summary.corrected} factura(s) con tarifas corregidas`);
      }
    } catch {
      toast.error('No se pudieron revisar las tarifas de las facturas');
    }
    setRunning(false);
  }, []);

  useEffect(() => {
    if (!open) { setResult(null); return; }
    if (!result && !running) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Revisión de tarifas de facturas
          </DialogTitle>
          <DialogDescription>
            Cada línea de envío se compara con la tarifa que le corresponde según el tipo de carga de su recibo (regular o alto riesgo),
            la fecha del recibo y el estado del cliente. Las facturas que se pueden reconstruir con certeza se corrigen solas (solo las líneas de envío y los
            totales que dependen de ellas); los pagos, el seguro, la consolidación y el puerta a puerta se conservan.
          </DialogDescription>
        </DialogHeader>

        {running ? (
          <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            Revisando las facturas manuales…
          </div>
        ) : result ? (
          <div className="space-y-4">
            <InvoiceRateAuditSummary reviewed={result.reviewed} summary={result.summary} />
            {result.applied && result.summary?.corrected > 0 && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Las correcciones ya quedaron aplicadas en las facturas.
              </p>
            )}
            <div className="max-h-[52vh] space-y-5 overflow-y-auto pr-1">
              <InvoiceRateAuditGroup
                kind="corrected"
                title="Corregidas"
                description="Su envío no coincidía con la tarifa del tipo de carga de cada recibo y se recalculó."
                items={result.corrected}
              />
              <InvoiceRateAuditGroup
                kind="review"
                title="Requieren revisión"
                description="No se pudieron recalcular con seguridad, así que no se tocaron."
                items={result.review}
              />
              <InvoiceRateAuditGroup
                kind="verified"
                title="Sin novedad"
                description="Su envío ya coincide con las tarifas vigentes de sus recibos."
                items={result.verified}
              />
            </div>
          </div>
        ) : (
          <p className="py-6 text-sm text-muted-foreground">No se pudo obtener el resultado de la revisión.</p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>Cerrar</Button>
          <Button onClick={run} disabled={running}>
            {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Revisar de nuevo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}