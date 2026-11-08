import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, Loader2, RotateCw, Smartphone, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { describeEvent, STATUS_LABELS, timeLabel } from '@/lib/storeForward/labels';

const ICONS = {
  pending: { Icon: Smartphone, cls: 'text-amber-600 bg-amber-50' },
  syncing: { Icon: Loader2, cls: 'text-info bg-info-bg', spin: true },
  error: { Icon: Clock, cls: 'text-amber-700 bg-amber-50' },
  conflict: { Icon: AlertTriangle, cls: 'text-destructive bg-red-50' },
};

// Una fila de la cola: qué es, cuándo se capturó en el teléfono y su estado.
export default function SyncEventRow({ item, onRetry, onDiscard }) {
  const status = item.result || item.sync_status || 'pending';
  const { Icon, cls, spin } = ICONS[status] || { Icon: CheckCircle2, cls: 'text-success bg-success-bg' };
  const { title, ref } = describeEvent(item);
  const when = timeLabel(item.device_created_at || item.created_at);

  return (
    <li className="flex items-start gap-3 rounded-xl border border-border/70 bg-card px-3 py-2.5">
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cls}`}>
        <Icon className={`h-4 w-4 ${spin ? 'animate-spin' : ''}`} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          {title} {ref && <span className="font-mono text-xs text-muted-foreground">{ref}</span>}
        </p>
        <p className="text-xs text-muted-foreground">
          {STATUS_LABELS[status] || status}{when ? ` · capturado ${when}` : ''}
        </p>
        {item.error_message && status !== 'pending' && (
          <p className="mt-0.5 text-xs text-destructive break-words">{item.error_message}</p>
        )}
        {status === 'conflict' && (onRetry || onDiscard) && (
          <div className="mt-2 flex gap-2">
            {onRetry && (
              <Button size="sm" variant="outline" onClick={() => onRetry(item.id)}>
                <RotateCw /> Reintentar
              </Button>
            )}
            {onDiscard && (
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDiscard(item)}>
                <Trash2 /> Descartar
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}