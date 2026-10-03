import React from 'react';
import moment from 'moment';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Send, Loader2, Clock } from 'lucide-react';

function statusTone(status) {
  if (status === 'ok' || status === 'enviado') return 'bg-emerald-100 text-emerald-700';
  if (status === 'error' || status === 'fallido') return 'bg-rose-100 text-rose-700';
  if (status === 'sin_clientes') return 'bg-slate-100 text-slate-600';
  return 'bg-amber-100 text-amber-700';
}

function when(value) {
  return value ? moment(value).format('DD/MM/YYYY HH:mm') : 'todavía no';
}

export default function WholesalerActionsBar({ config, busy, onSync, onResend }) {
  const runStatus = config?.last_run_status || 'nunca';
  const reportStatus = config?.last_report_status || 'nunca';

  return (
    <Card className="rounded-2xl border-0 shadow-card">
      <CardContent className="space-y-4 p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h3 className="font-display text-lg font-semibold text-foreground">
              {config?.wholesaler_name || 'Cliente mayorista'}
            </h3>
            <p className="text-sm text-muted-foreground">
              Última consulta: {when(config?.last_run_date)} · {config?.last_run_message || 'sin datos todavía'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onSync} disabled={busy} variant="outline" className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Consultar ahora
            </Button>
            <Button onClick={onResend} disabled={busy} className="gap-2">
              <Send className="h-4 w-4" />
              Reenviar informe
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge className={statusTone(runStatus)}>Consulta: {runStatus}</Badge>
          <Badge className={statusTone(reportStatus)}>Informe: {reportStatus}</Badge>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Último informe: {when(config?.last_report_date)}
          </span>
          {(config?.pending_notifications || 0) > 0 && (
            <Badge className="bg-amber-100 text-amber-700">
              {config.pending_notifications} aviso(s) pendiente(s) al mayorista
            </Badge>
          )}
        </div>

        {config?.last_report_message && (
          <p className="text-xs text-muted-foreground">Informe: {config.last_report_message}</p>
        )}
        {config?.last_reception_tracking && (
          <p className="text-xs text-muted-foreground">
            Última recepción desde su app: {config.last_reception_tracking} · {when(config.last_reception_date)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}