import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/components/api/ApiQueueManager';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const money = (v) => `$${num(v).toFixed(2)}`;
const fmtCbm = (v) => num(v).toFixed(5);

// Fusión de recibos repetidos: muestra qué queda, cómo cambian las facturas
// afectadas y ejecuta la fusión solo tras la confirmación explícita.
export default function DuplicateMergeDialog({ open, onOpenChange, groups, onDone, showClient }) {
  const [selected, setSelected] = useState([]);
  const [ackDistinct, setAckDistinct] = useState(false);
  const [merging, setMerging] = useState(false);
  const [result, setResult] = useState(null);

  const selectable = useMemo(() => (groups || []).filter((g) => !g.blocked), [groups]);
  const chosen = selectable.filter((g) => selected.includes(g.key));
  const needsAck = chosen.some((g) => g.distinct_invoices);

  // La selección se arma al abrir: los grupos pueden refrescarse después de
  // fusionar y el resumen debe seguir visible.
  useEffect(() => {
    if (!open) return;
    setResult(null);
    setMerging(false);
    setAckDistinct(false);
    setSelected((groups || []).filter((g) => !g.blocked && g.same_cbm).map((g) => g.key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (key) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleMerge = async () => {
    if (!chosen.length) return;
    if (needsAck && !ackDistinct) {
      toast.error('Confirma el ajuste de las facturas afectadas para continuar');
      return;
    }
    setMerging(true);
    try {
      const res = await base44.functions.invoke('mergeDuplicateReceipts', {
        mode: 'merge',
        groups: chosen.map((g) => ({
          ids: [g.keep.id, ...g.absorbed.map((a) => a.id)],
          keep_id: g.keep.id,
          order: g.order,
        })),
      });
      const data = res?.data || {};
      if (data.error) {
        toast.error(data.error);
        setMerging(false);
        return;
      }
      setResult({ summary: data.summary || {}, merged: data.merged || [], skipped: data.skipped || [] });
      if ((data.summary?.merged_groups || 0) > 0) {
        toast.success(`${data.summary.merged_groups} grupo(s) fusionado(s) correctamente`);
      } else {
        toast.error('No se pudo fusionar ningún grupo');
      }
      onDone?.(data);
    } catch {
      toast.error('Error al fusionar los recibos');
    }
    setMerging(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Fusionar recibos repetidos
          </DialogTitle>
          <DialogDescription>
            Se conserva un solo recibo por grupo con el CBM sumado y los trackings unidos; el duplicado se elimina.
            Si alguno ya está en una factura, esa factura se ajusta para no cobrar dos veces la misma carga.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold">Resumen de la fusión</span>
            </div>
            <ul className="text-sm text-slate-700 space-y-1">
              <li>{result.summary.merged_groups || 0} grupo(s) fusionado(s)</li>
              <li>{result.summary.merged_receipts || 0} recibo(s) unido(s) y eliminado(s)</li>
              <li>{result.summary.invoices_updated || 0} factura(s) revisada(s)</li>
              {num(result.summary.skipped_groups) > 0 && <li>{result.summary.skipped_groups} grupo(s) omitido(s)</li>}
            </ul>
            <div className="space-y-2">
              {result.merged.map((m) => (
                <div key={m.order} className="rounded-lg border border-border p-3 text-sm">
                  <p className="font-medium text-slate-800">N° {m.order} · {fmtCbm(m.cbm_before)} → {fmtCbm(m.cbm_after)} CBM</p>
                  <p className="text-slate-600">
                    {m.trackings} tracking(s) en el recibo final
                    {m.invoices?.length ? ` · facturas: ${m.invoices.map((i) => `${i.invoice_number} (${money(i.total_after)})`).join(', ')}` : ' · sin facturas afectadas'}
                  </p>
                </div>
              ))}
              {result.skipped.map((s, i) => (
                <div key={`${s.order}-${i}`} className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-100">
                  N° {s.order}: {s.reason}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {groups.map((g) => {
              const cbms = [g.keep.cbm, ...g.absorbed.map((a) => a.cbm)].map(fmtCbm).join(' + ');
              const isChosen = selected.includes(g.key);
              return (
                <div
                  key={g.key}
                  className={`rounded-xl border p-3 ${g.blocked ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30' : isChosen ? 'border-primary/50 bg-accent/40' : 'border-border'}`}
                >
                  <div className="flex items-start gap-3">
                    {!g.blocked && (
                      <Checkbox checked={isChosen} onCheckedChange={() => toggle(g.key)} className="mt-1" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-800">N° de orden {g.order}</span>
                        {showClient && <Badge variant="outline">{g.client_name}</Badge>}
                        <Badge className="border-0 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200">
                          {fmtCbm(g.merged_cbm)} CBM final
                        </Badge>
                        {g.shared_trackings && (
                          <Badge className="border-0 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100">comparten trackings</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {g.absorbed.length + 1} recibos → 1 · CBM {cbms} → {fmtCbm(g.merged_cbm)} · {g.merged_trackings_count} tracking(s) unidos
                      </p>
                      {g.invoices.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {g.invoices.map((inv) => (
                            <div key={inv.id} className="flex flex-wrap items-center gap-2 text-sm">
                              <span className="font-medium text-slate-700">Factura {inv.invoice_number}</span>
                              <Badge variant="outline">{inv.status}</Badge>
                              {inv.unchanged ? (
                                <span className="text-slate-500">sin cambios en el total ({money(inv.total_before)})</span>
                              ) : (
                                <span className="text-slate-700">{money(inv.total_before)} → <strong>{money(inv.total_after)}</strong></span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {g.warnings.map((w, i) => (
                        <p key={i} className="mt-1 text-xs text-amber-800 dark:text-amber-200">• {w}</p>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter className="gap-2">
          {result ? (
            <Button onClick={() => onOpenChange(false)}>Listo</Button>
          ) : (
            <>
              {needsAck && (
                <label className="mr-auto flex items-start gap-2 text-left text-xs text-slate-700">
                  <Checkbox checked={ackDistinct} onCheckedChange={(v) => setAckDistinct(!!v)} className="mt-0.5" />
                  <span>Entiendo que hay facturas distintas afectadas y que sus totales cambiarán.</span>
                </label>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={merging}>Cancelar</Button>
              <Button onClick={handleMerge} disabled={!chosen.length || merging || (needsAck && !ackDistinct)}>
                {merging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Fusionar {chosen.length} grupo{chosen.length === 1 ? '' : 's'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}