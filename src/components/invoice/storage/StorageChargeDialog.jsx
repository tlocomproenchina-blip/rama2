import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Play, Warehouse } from 'lucide-react';
import { toast } from 'sonner';
import StorageChargeInvoiceRow from './StorageChargeInvoiceRow';

const money = (value) => `$${(Number(value) || 0).toFixed(2)}`;

// Panel de cargos de almacenamiento y custodia: revisa qué se cobraría hoy en las
// facturas impagas (día 8 al 45) y solo al confirmar lo registra y avisa al cliente.
export default function StorageChargeDialog({ open, onOpenChange, onApplied }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('processStorageCharges', { mode: 'preview' });
      setData(res?.data || null);
    } catch {
      toast.error('No se pudieron revisar los cargos de almacenamiento');
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  const rows = useMemo(() => data?.results || [], [data]);
  const withChanges = rows.filter((r) => r.changed);

  const handleApply = async () => {
    setApplying(true);
    try {
      const res = await base44.functions.invoke('processStorageCharges', { mode: 'apply' });
      const totals = res?.data?.totals || {};
      if (totals.applied) {
        toast.success(`${totals.applied} factura(s) actualizadas con cargos de almacenamiento`);
      } else {
        toast.info('No había cargos nuevos por registrar');
      }
      if (totals.emails_sent) toast.info(`${totals.emails_sent} aviso(s) enviados al cliente`);
      setConfirmOpen(false);
      await load();
      onApplied?.();
    } catch {
      toast.error('No se pudieron aplicar los cargos de almacenamiento');
    }
    setApplying(false);
  };

  const config = data?.config || {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5" />
            Cargos de almacenamiento y custodia
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Días 1 al 7 gratis. Desde el día 8: {money(config.standard_daily_rate || 10)} diarios por bulto estándar y{' '}
            {money(config.large_daily_rate || 20)} por bulto grande, más {money(config.forklift_fee || 150)} por palet con
            montacargas (cargo único). Se acumula hasta el día {config.max_days || 45}.
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600">
              <span><strong className="text-slate-800">{rows.length}</strong> factura(s) impagas en el período</span>
              <span className="text-amber-700"><strong>{withChanges.length}</strong> con cargos nuevos</span>
              <span>
                Se agregaría:{' '}
                <strong className="text-slate-800">{money(withChanges.reduce((s, r) => s + (Number(r.amount) || 0), 0))}</strong>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
                Revisar
              </Button>
              <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={!withChanges.length || loading}>
                <Play className="mr-2 h-3.5 w-3.5" />
                Ejecutar {withChanges.length ? `${withChanges.length} factura(s)` : 'cargos'}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Ninguna factura impaga está entre el día 8 y el {config.max_days || 45} desde su emisión.
            </p>
          ) : (
            <div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">
              {rows.map((row) => (
                <StorageChargeInvoiceRow key={row.invoice_id} row={row} onRefresh={load} />
              ))}
            </div>
          )}
        </div>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Registrar los cargos de almacenamiento de hoy?</AlertDialogTitle>
              <AlertDialogDescription>
                Se sumarán {money(withChanges.reduce((s, r) => s + (Number(r.amount) || 0), 0))} al saldo de{' '}
                {withChanges.length} factura(s) y se avisará a los clientes por notificación y email. Los días ya cargados
                no se cobran dos veces y el desglose queda registrado para auditoría.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={applying}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleApply} disabled={applying}>
                {applying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrar cargos
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}