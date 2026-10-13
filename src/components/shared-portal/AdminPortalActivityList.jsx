import React from 'react';
import { Badge } from '@/components/ui/badge';
import { portalDateTimeText } from '@/lib/sharedPortalFormat';

const EVENT_LABELS = { consulta: 'Consulta', exportacion: 'Exportación', rechazo: 'Rechazo' };
const RESULT_LABELS = {
  ok: 'entregada',
  sin_resultados: 'sin resultados',
  con_tope: 'con tope',
  seleccion: 'selección',
  codigo_incorrecto: 'código incorrecto',
  codigo_requerido: 'pidió código',
  revocado: 'enlace revocado',
  vencido: 'enlace vencido',
};

function eventClass(type) {
  if (type === 'rechazo') return 'border-destructive/30 bg-destructive/10 text-destructive';
  if (type === 'exportacion') return 'border-sky-200 bg-sky-50 text-sky-700';
  return 'border-border bg-secondary text-foreground';
}

export default function AdminPortalActivityList({ logs, emptyText }) {
  if (!logs?.length) {
    return <p className="text-sm text-muted-foreground">{emptyText || 'Todavía no hay movimientos con este enlace.'}</p>;
  }

  return (
    <div className="divide-y divide-border/70">
      {logs.map((log) => (
        <div key={log.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={eventClass(log.event_type)}>
                {EVENT_LABELS[log.event_type] || log.event_type}
              </Badge>
              {log.link_label ? <span className="text-xs font-medium text-foreground">{log.link_label}</span> : null}
              <span className="text-xs text-muted-foreground">
                {log.result ? RESULT_LABELS[log.result] || log.result : ''}
                {log.rows ? ` · ${log.rows} registro(s)` : ''}
                {log.format ? ` · ${log.format}` : ''}
              </span>
            </div>
            {log.filters ? <p className="truncate text-xs text-muted-foreground">Filtros: {log.filters}</p> : null}
            {log.detail ? <p className="truncate text-xs text-muted-foreground">{log.detail}</p> : null}
          </div>
          <p className="shrink-0 text-xs text-muted-foreground">{portalDateTimeText(log.event_date)}</p>
        </div>
      ))}
    </div>
  );
}