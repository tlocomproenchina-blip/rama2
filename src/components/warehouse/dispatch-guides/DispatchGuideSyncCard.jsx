import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, RefreshCw, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import DispatchGuideSyncSummary from './DispatchGuideSyncSummary';

const BATCH_SIZE = 25;
const MAX_ROUNDS = 40;

// Sincroniza con las guías todo lo escaneado en Despacho por Escaneo que todavía no
// está en una guía: el backend archiva por lotes y aquí se repite la llamada hasta
// terminar, mostrando el avance y el resumen final.
export default function DispatchGuideSyncCard({ reloadSignal = 0, onSynced }) {
  const [pending, setPending] = useState(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ archived: 0, total: 0 });
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  const loadPending = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('syncDispatchScansToGuides', { count_only: true });
      const data = res?.data || res || {};
      if (typeof data.pending === 'number') setPending(data.pending);
    } catch (_) {}
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending, reloadSignal]);

  const runSync = async () => {
    setRunning(true);
    setError('');
    setSummary(null);
    const skipCodes = [];
    const skipped = [];
    let archived = 0;
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    let guidesTouched = 0;
    let total = Number(pending) || 0;
    let finished = false;

    try {
      for (let round = 0; round < MAX_ROUNDS; round += 1) {
        const res = await base44.functions.invoke('syncDispatchScansToGuides', {
          skip_codes: skipCodes,
          limit: BATCH_SIZE,
        });
        const data = res?.data || res || {};
        if (data.error) throw new Error(data.error);

        if (round === 0) {
          total = Math.max(total, Number(data.pending_before) || 0, Number(data.pending) || 0);
        }
        created += Number(data.created) || 0;
        guidesTouched += Number(data.guides_touched) || 0;
        updated += Number(data.updated) || 0;
        unchanged += Number(data.unchanged) || 0;
        archived += Number(data.archived) || 0;
        (Array.isArray(data.skipped) ? data.skipped : []).forEach((item) => {
          skipped.push(item);
          skipCodes.push(item.code);
        });

        setProgress({ archived, total: total || archived });
        if (data.done || Number(data.pending) === 0) {
          finished = true;
          break;
        }
      }

      setSummary({ created, guidesTouched, updated, unchanged, archived, skipped, partial: !finished });
      if (archived > 0) toast.success(`${archived} escaneo(s) archivados en guías`);
      else toast.warning('No se pudo archivar ningún escaneo');
      await loadPending();
      onSynced?.();
    } catch (e) {
      setError('No se pudo completar la sincronización. Revisa la conexión e inténtalo otra vez.');
      toast.error('No se pudo sincronizar los escaneos');
    }
    setRunning(false);
  };

  if (!running && !summary && (pending === null || pending === 0)) return null;

  const hasPending = (Number(pending) || 0) > 0;
  const percent = progress.total > 0 ? Math.min(Math.round((progress.archived / progress.total) * 100), 100) : 0;

  return (
    <Card className="border-primary/25 bg-accent/40">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-2xl bg-primary/10 p-2 text-primary">
            <ScanLine className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-semibold text-foreground">
              Sincronizar escaneos sin guía
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {hasPending
                ? `${pending} escaneo(s) de bulto de Despacho por Escaneo todavía no están en una guía. Al sincronizar se archivan en la guía de su cliente y se abre una nueva si aún no la tiene.`
                : 'Todos los escaneos de Despacho por Escaneo ya están en una guía.'}
            </p>
          </div>
        </div>

        {running && (
          <div className="space-y-2">
            <Progress value={percent} />
            <p className="text-[11px] text-muted-foreground">
              Archivados {progress.archived} de {progress.total || '…'}
            </p>
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </p>
        )}

        {(hasPending || running) && (
          <Button className="w-full gap-2 sm:w-auto" onClick={runSync} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {running ? 'Sincronizando…' : 'Sincronizar'}
          </Button>
        )}

        {summary && <DispatchGuideSyncSummary summary={summary} onRetry={runSync} retrying={running} />}
      </CardContent>
    </Card>
  );
}