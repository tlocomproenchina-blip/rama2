import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, Check } from 'lucide-react';
import { toast } from 'sonner';
import moment from 'moment';

const formatDate = (iso) => (iso ? moment(iso).format('DD/MM/YYYY HH:mm') : '—');

function Stat({ label, value, tone }) {
  const toneClass = tone === 'warn' ? 'text-amber-700' : tone === 'ok' ? 'text-green-700' : 'text-slate-800';
  return (
    <div className="rounded-xl border border-border bg-card/70 px-3 py-2">
      <p className={`text-xl font-display font-bold ${toneClass}`}>{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

// Panel de verificación: bultos marcados como "Despachado" que no aparecen despachados
// en /WarehouseDispatch (sin orden de despacho, sin foto de salida ni escaneo de despacho).
// Los corrige a "En Almacén Venezuela" solo al confirmar.
export default function BultoStatusAuditPanel({ onApplied }) {
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [summary, setSummary] = useState(null);
  const [result, setResult] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const runCheck = async () => {
    setChecking(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('backfillBultosEnAlmacenVe', { apply: false });
      const data = res?.data || {};
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setSummary(data);
    } catch (_) {
      toast.error('No se pudieron verificar los estados');
    } finally {
      setChecking(false);
    }
  };

  const runFix = async () => {
    setApplying(true);
    try {
      const res = await base44.functions.invoke('backfillBultosEnAlmacenVe', { apply: true });
      const data = res?.data || {};
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setResult(data);
      setSummary(null);
      setConfirmOpen(false);
      onApplied?.();
      toast.success(`${data.updated} bulto(s) corregidos a En Almacén Venezuela`);
    } catch (_) {
      toast.error('No se pudieron corregir los estados');
    } finally {
      setApplying(false);
    }
  };

  const pending = summary?.to_fix || 0;
  const realDispatch = summary?.real_dispatch || result?.real_dispatch || 0;

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 text-sm">Bultos que muestran "Despachado" sin despacho real</p>
              <p className="text-xs text-slate-500">
                Revisa cuáles no aparecen despachados en /WarehouseDispatch y los devuelve a "En Almacén Venezuela".
                Nunca toca los bultos con despacho real.
              </p>
            </div>
          </div>
          <Button onClick={runCheck} disabled={checking} variant="outline" className="shrink-0">
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {checking ? 'Verificando…' : 'Verificar estados'}
          </Button>
        </div>

        {result && (
          <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            <p className="text-sm text-green-800">
              <strong>{result.updated}</strong> bulto(s) corregidos a En Almacén Venezuela ·{' '}
              <strong>{realDispatch}</strong> con despacho real sin cambios
              {result.packages_reverted > 0 && <> · {result.packages_reverted} paquete(s) devueltos a "Recibido"</>}
            </p>
          </div>
        )}

        {summary && pending === 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2">
            <ShieldCheck className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            <p className="text-sm text-green-800">
              Todo en orden: los {summary.total_despachados} bultos marcados como Despachado tienen despacho real
              registrado. No hay nada que corregir.
            </p>
          </div>
        )}

        {summary && pending > 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <Stat label="Marcados Despachado" value={summary.total_despachados} />
              <Stat label="A corregir" value={pending} tone="warn" />
              <Stat label="Con despacho real" value={realDispatch} tone="ok" />
            </div>

            <div className="text-xs text-slate-600 space-y-0.5">
              <p>
                Con paquetes: <strong>{summary.with_packages}</strong> · Etiquetas vacías: <strong>{summary.empty}</strong> ·
                Escaneadas hoy en almacén: <strong>{summary.scanned_today}</strong>
              </p>
              {summary.from_date && (
                <p className="text-slate-500">
                  Antigüedad: {formatDate(summary.from_date)} → {formatDate(summary.to_date)}
                </p>
              )}
            </div>

            {summary.examples?.length > 0 && (
              <div className="rounded-xl border border-border bg-card/70 p-3 space-y-1.5">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Ejemplos a corregir</p>
                {summary.examples.map((ex) => (
                  <div key={ex.label_code} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono text-slate-700 break-all">{ex.label_code}</span>
                    <span className="text-slate-500 truncate">{ex.client_name}</span>
                    <span className="text-slate-400">{formatDate(ex.created_date)}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-slate-600">
                      {ex.empty ? 'Etiqueta vacía' : `${ex.package_count} paq.`}
                    </span>
                    {ex.scanned_today && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700">Escaneado hoy</span>
                    )}
                  </div>
                ))}
                {pending > summary.examples.length && (
                  <p className="text-[11px] text-slate-500">… y {pending - summary.examples.length} más</p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setConfirmOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                <Check className="h-4 w-4" /> Corregir {pending} bulto(s)
              </Button>
              <Button variant="ghost" onClick={runCheck} disabled={checking}>
                Verificar de nuevo
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={(o) => !applying && setConfirmOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" /> Corregir estados de bultos
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-slate-600 space-y-2">
            <p>
              Se cambiarán <strong>{pending} bulto(s)</strong> de "Despachado" a <strong>En Almacén Venezuela</strong>.
            </p>
            <p>
              Los <strong>{realDispatch} bulto(s)</strong> con despacho real en /WarehouseDispatch no se tocarán.
              Los paquetes que hubieran quedado como despachados vuelven a "Recibido".
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={applying}>
              Cancelar
            </Button>
            <Button onClick={runFix} disabled={applying} className="bg-blue-600 hover:bg-blue-700">
              {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Corregir ahora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}