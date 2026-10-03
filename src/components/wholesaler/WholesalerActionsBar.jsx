import React from 'react';
import moment from 'moment';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Send, Loader2, Clock } from 'lucide-react';

function when(value) {
  return value ? moment(value).format('DD/MM/YYYY HH:mm') : 'todavía no';
}

function latest(values) {
  const list = (values || []).filter(Boolean).sort();
  return list.length ? list[list.length - 1] : null;
}

// Resumen de todas las conexiones y las dos acciones generales: consultar ahora
// (recorre todos los mayoristas) y reenviar los informes.
export default function WholesalerActionsBar({ connections = [], busy, onSync, onResend }) {
  const total = connections.length;
  const conectadas = connections.filter((c) => c.connection_status === 'conectado').length;
  const conProblema = connections.filter((c) => c.connection_status === 'error').length;
  const sinProbar = total - conectadas - conProblema;
  const avisosPendientes = connections.reduce((sum, c) => sum + (Number(c.pending_notifications) || 0), 0);
  const ultimaConsulta = latest(connections.map((c) => c.last_run_date));
  const ultimoInforme = latest(connections.map((c) => c.last_report_date));

  return (
    <Card className="rounded-2xl border-0 shadow-card">
      <CardContent className="space-y-4 p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h3 className="font-display text-lg font-semibold text-foreground">Cruce con los mayoristas</h3>
            <p className="text-sm text-muted-foreground">Última consulta general: {when(ultimaConsulta)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onSync} disabled={busy} variant="outline" className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Consultar ahora
            </Button>
            <Button onClick={onResend} disabled={busy} className="gap-2">
              <Send className="h-4 w-4" />
              Reenviar informes
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge className="bg-slate-100 text-slate-600">{total} conexión(es)</Badge>
          <Badge className="bg-emerald-100 text-emerald-700">{conectadas} conectada(s)</Badge>
          {conProblema > 0 && <Badge className="bg-rose-100 text-rose-700">{conProblema} con problema</Badge>}
          {sinProbar > 0 && <Badge className="bg-slate-100 text-slate-600">{sinProbar} sin probar</Badge>}
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Último informe: {when(ultimoInforme)}
          </span>
          {avisosPendientes > 0 && (
            <Badge className="bg-amber-100 text-amber-700">{avisosPendientes} aviso(s) pendiente(s)</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}