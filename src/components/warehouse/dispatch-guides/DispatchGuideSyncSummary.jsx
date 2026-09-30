import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Tile = ({ label, value }) => (
  <div className="rounded-xl border border-border/70 bg-card/70 px-3 py-2">
    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="font-display text-lg font-semibold text-foreground">{value}</p>
  </div>
);

// Resumen de la sincronización: guías creadas, guías completadas, bultos
// archivados y los escaneos que no se pudieron asociar (con reintento).
export default function DispatchGuideSyncSummary({ summary, onRetry, retrying }) {
  const skipped = summary?.skipped || [];
  const placed = (Number(summary?.created) || 0) + (Number(summary?.updated) || 0);

  return (
    <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
        <CheckCircle2 className="h-4 w-4" /> Sincronización terminada
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Guías creadas" value={Number(summary?.created) || 0} />
        <Tile label="Guías completadas" value={Number(summary?.guidesTouched) || 0} />
        <Tile label="Bultos archivados" value={placed} />
        <Tile label="Sin resolver" value={skipped.length} />
      </div>

      {Number(summary?.unchanged) > 0 && (
        <p className="text-xs text-muted-foreground">
          {summary.unchanged} bulto(s) ya estaban en su guía y no se duplicaron.
        </p>
      )}

      {summary?.partial && (
        <p className="text-xs text-muted-foreground">
          Quedan escaneos por archivar: vuelve a pulsar Sincronizar para continuar.
        </p>
      )}

      {skipped.length > 0 && (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" /> No se pudieron asociar ({skipped.length})
          </p>
          <ul className="space-y-1 text-[11px] text-amber-800 dark:text-amber-200">
            {skipped.slice(0, 6).map((item) => (
              <li key={item.code} className="break-all font-mono">
                {item.code} — {item.reason}
              </li>
            ))}
            {skipped.length > 6 && <li>y {skipped.length - 6} más…</li>}
          </ul>
          <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={onRetry} disabled={retrying}>
            {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Reintentar
          </Button>
        </div>
      )}
    </div>
  );
}