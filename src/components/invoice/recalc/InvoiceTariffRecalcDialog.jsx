import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Calculator, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import InvoiceRecalcRow from './InvoiceRecalcRow';

const money = (v) => `$${(Number(v) || 0).toFixed(2)}`;

const PENDING_STATUSES = ['pendiente', 'vencida', 'revision'];

// Recálculo de tarifas de todas las facturas: cada envío se cobra con la tarifa
// del tipo de carga de su propio recibo, en vez del promedio prorrateado.
// Primero se revisa (antes → después) y solo al confirmar se aplica.
export default function InvoiceTariffRecalcDialog({ open, onOpenChange, onApplied }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [scope, setScope] = useState('all');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [excluded, setExcluded] = useState(() => new Set());
  const overridesRef = useRef({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('recalculateInvoices', {
        mode: 'preview',
        type_overrides: overridesRef.current,
      });
      setInvoices(res?.data?.invoices || []);
    } catch {
      toast.error('No se pudo calcular el recálculo de tarifas');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    overridesRef.current = {};
    setExcluded(new Set());
    setOnlyChanged(false);
    setScope('all');
    load();
  }, [open, load]);

  // Al cambiar el tipo de carga de un recibo se recalcula solo esa factura.
  const handleTypeChange = async (invoiceId, key, type) => {
    overridesRef.current = { ...overridesRef.current, [key]: type };
    try {
      const res = await base44.functions.invoke('recalculateInvoices', {
        mode: 'preview',
        type_overrides: overridesRef.current,
        invoice_ids: [invoiceId],
      });
      const updated = res?.data?.invoices?.[0];
      if (updated) setInvoices((prev) => prev.map((i) => (i.invoice_id === invoiceId ? updated : i)));
    } catch {
      toast.error('No se pudo recalcular esa factura');
    }
  };

  const toggleExclude = (invoiceId) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(invoiceId)) next.delete(invoiceId);
      else next.add(invoiceId);
      return next;
    });
  };

  // Alcance: todas las facturas o solo las que están pendientes por pagar.
  const inScope = useMemo(
    () => (scope === 'pending' ? invoices.filter((i) => PENDING_STATUSES.includes(i.status)) : invoices),
    [invoices, scope]
  );
  const changedInvoices = useMemo(
    () => inScope.filter((i) => i.changed && !i.blocked),
    [inScope]
  );
  const blockedCount = useMemo(() => inScope.filter((i) => i.blocked).length, [inScope]);
  const targets = useMemo(
    () => changedInvoices.filter((i) => !excluded.has(i.invoice_id)),
    [changedInvoices, excluded]
  );
  const diff = useMemo(
    () => targets.reduce((s, i) => s + ((Number(i.after?.total) || 0) - (Number(i.before?.total) || 0)), 0),
    [targets]
  );
  const visible = onlyChanged ? inScope.filter((i) => i.changed) : inScope;

  const handleApply = async () => {
    if (!targets.length) return;
    setApplying(true);
    try {
      const res = await base44.functions.invoke('recalculateInvoices', {
        mode: 'apply',
        invoice_ids: targets.map((i) => i.invoice_id),
        type_overrides: overridesRef.current,
      });
      const applied = res?.data?.applied || [];
      const skipped = res?.data?.skipped || [];
      if (applied.length) toast.success(`${applied.length} factura(s) recalculadas con la tarifa de cada recibo`);
      if (skipped.length) toast.error(`${skipped.length} factura(s) no se pudieron actualizar`);
      setConfirmOpen(false);
      await load();
      onApplied?.();
    } catch {
      toast.error('No se pudo aplicar el recálculo');
    }
    setApplying(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !applying && onOpenChange(v)}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-blue-600" />
              Recalcular tarifas de facturas
            </DialogTitle>
          </DialogHeader>

          <p className="text-xs text-slate-500">
            Cada envío se cobra con la tarifa de su propio recibo (general o alto riesgo/sensible) y la fecha de ese recibo,
            en lugar del promedio prorrateado que quedó guardado. Revisa el antes y el después y aplica solo lo que confirmes.
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600">
              <div className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${scope === 'all' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={() => setScope('pending')}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${scope === 'pending' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  Pendientes por pagar
                </button>
              </div>
              <span><strong className="text-slate-800">{inScope.length}</strong> factura(s)</span>
              <span className="text-amber-700"><strong>{changedInvoices.length}</strong> con cambio</span>
              <span><strong>{blockedCount}</strong> sin ajuste automático</span>
              <span>
                Diferencia seleccionada:{' '}
                <strong className={diff > 0 ? 'text-amber-700' : 'text-emerald-700'}>
                  {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                </strong>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-[11px] text-slate-600">
                <Checkbox checked={onlyChanged} onCheckedChange={setOnlyChanged} />
                Solo con cambios
              </label>
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
                Actualizar
              </Button>
              <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={!targets.length || loading}>
                {scope === 'pending' ? `Ajustar ${targets.length} pendiente(s)` : `Aplicar ${targets.length} factura(s)`}
              </Button>
            </div>
          </div>

          {!loading && scope === 'pending' && inScope.length > 0 && !changedInvoices.length && (
            <p className="rounded-lg bg-emerald-50 p-2.5 text-[11px] text-emerald-800">
              Las {inScope.length} facturas pendientes por pagar ya están cobradas con la tarifa del tipo de cada recibo: no hay nada que ajustar.
              Si un recibo es alto riesgo/sensible, cámbiale el tipo de carga en el detalle y el ajuste aparecerá.
            </p>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
            </div>
          ) : visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              {onlyChanged ? 'Ninguna factura cambia con las tarifas actuales.' : 'No hay facturas para revisar.'}
            </p>
          ) : (
            <div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">
              {visible.map((invoice) => (
                <InvoiceRecalcRow
                  key={invoice.invoice_id}
                  invoice={invoice}
                  excluded={excluded.has(invoice.invoice_id)}
                  onToggleExclude={toggleExclude}
                  onTypeChange={handleTypeChange}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar el recálculo a {targets.length} factura(s)</AlertDialogTitle>
            <AlertDialogDescription>
              Se reescribirán las líneas de envío con la tarifa de cada recibo y se ajustará el total de cada factura.
              {targets.some((i) => i.paid) && ' Algunas ya están pagadas: su total cambiará y el saldo del cliente también.'}
              {' '}El costo al proveedor y la ganancia no se recalculan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applying}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleApply(); }}
              disabled={applying}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {applying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Aplicando...</> : 'Aplicar recálculo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}