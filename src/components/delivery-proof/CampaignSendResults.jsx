import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, History, Loader2 } from 'lucide-react';

function statusBadge(status) {
  if (status === 'enviada') return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Campaña enviada</Badge>;
  if (status === 'parcial') return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Envío parcial</Badge>;
  if (status === 'fallida') return <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">Envío fallido</Badge>;
  return <Badge variant="outline">Sin envíos previos</Badge>;
}

export default function CampaignSendResults({ result, lastRun, sending }) {
  const rows = result?.results?.length ? result.results : lastRun?.results || [];
  const status = result?.status || lastRun?.status || 'nunca';
  const message = result?.message || lastRun?.message || '';
  const date = result?.date || lastRun?.date || null;
  const sent = result?.sent ?? lastRun?.sent ?? 0;
  const failed = result?.failed ?? lastRun?.failed ?? 0;

  return (
    <Card className="border-border/70 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <History className="h-4 w-4 text-primary" /> Resultado por cliente
          {sending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {statusBadge(status)}
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="mr-1 h-3 w-3" /> {sent} enviados
          </Badge>
          {failed > 0 ? (
            <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">
              <AlertCircle className="mr-1 h-3 w-3" /> {failed} fallidos
            </Badge>
          ) : null}
        </div>

        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        {date ? (
          <p className="text-xs text-muted-foreground">
            Último envío: {new Date(date).toLocaleString('es-VE', { timeZone: 'America/Caracas' })}
            {lastRun?.by && !result ? ` · ${lastRun.by}` : ''}
          </p>
        ) : null}

        {rows.length ? (
          <div className="max-h-80 divide-y divide-border/60 overflow-y-auto rounded-2xl border border-border/70">
            {rows.map((row) => (
              <div key={`${row.email}-${row.date}`} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">{row.client_name || row.email}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {row.email}
                    {row.error ? ` · ${row.error}` : ''}
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className={`shrink-0 text-xs ${row.status === 'enviado' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}
                >
                  {row.status === 'enviado' ? 'Enviado' : 'Falló'}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Todavía no se ha enviado esta campaña. Al confirmar el envío verás aquí a quién le llegó el correo.
          </p>
        )}
      </CardContent>
    </Card>
  );
}