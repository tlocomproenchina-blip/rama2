import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Lock, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

const money = (v) => `$${(Number(v) || 0).toFixed(2)}`;

const SKIP_LABELS = {
  ya_protegida: 'Ya está protegida',
  sin_registro: 'Sin monto anterior registrado',
  sin_linea_envio: 'No tiene línea de envío',
  monto_distinto: 'Su envío cambió después: revisar a mano',
  sin_reduccion: 'No hubo reducción',
};

// Restablece el envío de las facturas que el recálculo de tarifas dejó por debajo
// del monto documentado y las deja protegidas contra nuevas ediciones.
export default function RestoreProtectedInvoicesDialog({ open, onOpenChange, onApplied }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [excluded, setExcluded] = useState(() => new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('restoreProtectedInvoices', { mode: 'preview' });
      setRows(res?.data?.invoices || []);
    } catch {
      toast.error('No se pudo revisar las facturas a restablecer');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    setExcluded(new Set());
    load();
  }, [open, load]);

  const restorable = useMemo(() => rows.filter((r) => r.updates), [rows]);
  const targets = useMemo(() => restorable.filter((r) => !excluded.has(r.invoice_id)), [restorable, excluded]);
  const diff = useMemo(
    () => targets.reduce((s, r) => s + (Number(r.after?.total) - Number(r.before?.total) || 0), 0),
    [targets]
  );

  const toggle = (id) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApply = async () => {
    if (!targets.length) return;
    setApplying(true);
    try {
      const res = await base44.functions.invoke('restoreProtectedInvoices', {
        mode: 'apply',
        invoice_ids: targets.map((r) => r.invoice_id),
      });
      const applied = res?.data?.applied || [];
      if (applied.length) toast.success(`${applied.length} factura(s) restablecida(s) y protegida(s)`);
      setConfirmOpen(false);
      await load();
      onApplied?.();
    } catch {
      toast.error('No se pudo restablecer las facturas');
    }
    setApplying(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !applying && onOpenChange(v)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Restablecer y proteger facturas
            </DialogTitle>
          </DialogHeader>

          <p className="text-xs text-slate-500">
            Vuelve el envío de cada factura al monto que tenía antes del recálculo (el que quedó escrito en su
            historial y avisado al cliente) y la deja protegida. No toca pagos, estado ni costo del proveedor.
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600">
              <span><strong className="text-slate-800">{restorable.length}</strong> a restablecer</span>
              <span>Diferencia seleccionada: <strong className="text-emerald-700">+{diff.toFixed(2)}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
                Actualizar
              </Button>
              <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={!targets.length || loading}>
                Restablecer {targets.length}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              No hay facturas con un monto anterior documentado.
            </p>
          ) : (
            <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
              {rows.map((row) => {
                const locked = row.skipped === 'ya_protegida';
                const ok = !!row.updates;
                return (
                  <div
                    key={row.invoice_id}
                    className={`rounded-xl border p-3 ${ok ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50'}`}
                  >
                    <div className="flex items-start gap-3">
                      {ok ? (
                        <Checkbox
                          checked={!excluded.has(row.invoice_id)}
                          onCheckedChange={() => toggle(row.invoice_id)}
                          className="mt-1"
                        />
                      ) : (
                        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{row.invoice_number}</p>
                        <p className="truncate text-[11px] text-slate-500">{row.client_email}</p>
                        {ok ? (
                          <p className="mt-1 text-[11px] text-slate-600">
                            Envío {money(row.before?.shipping)} → <strong className="text-emerald-700">{money(row.after?.shipping)}</strong>
                            {' · '}Total {money(row.before?.total)} → <strong className="text-emerald-700">{money(row.after?.total)}</strong>
                          </p>
                        ) : (
                          <p className="mt-1 text-[11px] text-slate-500">
                            {locked ? 'Ya protegida' : (SKIP_LABELS[row.skipped] || 'No aplica')}
                            {row.documented_shipping != null && row.skipped === 'monto_distinto'
                              ? ` (documentado ${money(row.documented_shipping)}, actual ${money(row.before?.shipping)})`
                              : ''}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        {row.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restablecer {targets.length} factura(s)</AlertDialogTitle>
            <AlertDialogDescription>
              Se volverá el envío al monto anterior documentado y cada factura quedará protegida: no podrá
              editarse ni recalcularse de nuevo. Los pagos registrados no se modifican.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applying}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleApply(); }}
              disabled={applying}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {applying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Restableciendo...</> : 'Restablecer y proteger'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}