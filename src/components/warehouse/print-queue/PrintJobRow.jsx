import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, Loader2, RotateCcw, XCircle } from 'lucide-react';

const STATUS = {
  pending: { label: 'En espera', icon: Clock, cls: 'bg-warning-bg text-warning' },
  printing: { label: 'Imprimiendo', icon: Loader2, cls: 'bg-info-bg text-info', spin: true },
  done: { label: 'Impreso', icon: CheckCircle2, cls: 'bg-success-bg text-success' },
  failed: { label: 'Falló', icon: XCircle, cls: 'bg-destructive/10 text-destructive' },
};

const timeOf = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
  } catch (_) {
    return '';
  }
};

// Un trabajo de la cola compartida: qué es, quién lo mandó y en qué estado va.
export default function PrintJobRow({ job, onRetry, retrying }) {
  const st = STATUS[job.status] || STATUS.pending;
  const Icon = st.icon;
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-card px-3 py-2.5">
      <div className="min-w-0 space-y-0.5">
        <p className="truncate text-sm font-semibold text-foreground">{job.title || 'Etiquetas'}</p>
        <p className="text-xs text-muted-foreground">
          {job.requested_by_name || job.requested_by || 'Operador'} · {timeOf(job.created_date)}
          {job.label_count ? ` · ${job.label_count} etiqueta(s)` : ''}
        </p>
        {job.status === 'failed' && job.error && (
          <p className="text-xs text-destructive">{job.error}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>
          <Icon className={`h-3 w-3 ${st.spin ? 'animate-spin' : ''}`} /> {st.label}
        </span>
        {job.status === 'failed' && onRetry && (
          <Button size="sm" variant="outline" className="h-8 px-2.5" disabled={retrying} onClick={() => onRetry(job)}>
            <RotateCcw className="h-3.5 w-3.5" /> Reintentar
          </Button>
        )}
      </div>
    </div>
  );
}