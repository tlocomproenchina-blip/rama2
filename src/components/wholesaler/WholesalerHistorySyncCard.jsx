import React from 'react';
import moment from 'moment';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, Loader2, RefreshCw } from 'lucide-react';
import WholesalerHistoryDetailList from '@/components/wholesaler/WholesalerHistoryDetailList';

function when(value) {
  return value ? moment(value).format('DD/MM/YYYY HH:mm') : 'todavía no';
}

// Historial de pre-alertas: pide a cada mayorista todo su historial y lo alinea
// aquí. La acción general se dispara a mano; el horario lo repite cada día.
export default function WholesalerHistorySyncCard({ connections = [], busy, onSync }) {
  const activas = connections.filter((c) => String(c.history_feed_url || '').trim() && c.history_sync_enabled !== false);
  const ejecutadas = connections.map((c) => c.last_history_run_date).filter(Boolean).sort();
  const ultima = ejecutadas.length ? ejecutadas[ejecutadas.length - 1] : null;
  const totales = connections.reduce((acc, c) => ({
    nuevos: acc.nuevos + (Number(c.last_history_new) || 0),
    actualizados: acc.actualizados + (Number(c.last_history_updated) || 0),
    omitidos: acc.omitidos + (Number(c.last_history_skipped) || 0),
  }), { nuevos: 0, actualizados: 0, omitidos: 0 });
  // Coincidencias ya recibidas en el almacén que se le devolvieron al mayorista.
  const avisos = connections.reduce((acc, c) => ({
    enviados: acc.enviados + (Number(c.last_history_notified) || 0),
    fallidos: acc.fallidos + (Number(c.last_history_notify_failed) || 0),
    pendientes: acc.pendientes + (Number(c.last_history_notify_pending) || 0),
    asignados: acc.asignados + (Number(c.last_history_assigned) || 0),
  }), { enviados: 0, fallidos: 0, pendientes: 0, asignados: 0 });

  return (
    <Card className="rounded-2xl border-0 shadow-card">
      <CardContent className="space-y-4 p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
              <History className="h-4 w-4 text-primary" />
              Historial de pre-alertas
            </h3>
            <p className="text-sm text-muted-foreground">
              Pide a cada mayorista todo su historial de pre-alertas y lo deja alineado aquí. Lo que ya existe no se
              duplica ni se pisa: solo se le completan los datos que faltaban. Al terminar le devuelve las
              coincidencias que ya están recibidas en el almacén, con su tracking, su cliente y su foto, para que su
              app las marque como recibidas. Se ejecuta solo todos los días a las 3:00 a.m. (Caracas).
            </p>
          </div>
          <Button onClick={onSync} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sincronizar historial
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge className="bg-slate-100 text-slate-600">{activas.length} de {connections.length} conexión(es) activa(s)</Badge>
          <Badge className="bg-emerald-100 text-emerald-700">{totales.nuevos} nueva(s)</Badge>
          <Badge className="bg-sky-100 text-sky-700">{totales.actualizados} completada(s)</Badge>
          <Badge className="bg-slate-100 text-slate-600">{totales.omitidos} ya alineada(s)</Badge>
          {avisos.asignados > 0 && (
            <Badge className="bg-teal-100 text-teal-700">{avisos.asignados} con titular asignado</Badge>
          )}
          {avisos.enviados > 0 && (
            <Badge className="bg-emerald-100 text-emerald-700">{avisos.enviados} devuelta(s) al mayorista</Badge>
          )}
          {avisos.fallidos > 0 && (
            <Badge className="bg-rose-100 text-rose-700">{avisos.fallidos} aviso(s) fallido(s)</Badge>
          )}
          {avisos.pendientes > 0 && (
            <Badge className="bg-amber-100 text-amber-700">{avisos.pendientes} pendiente(s) de devolver</Badge>
          )}
          <span className="text-muted-foreground">Última sincronización: {when(ultima)}</span>
        </div>

        {connections.length ? (
          <div className="space-y-2">
            {connections.map((connection) => {
              const sinDireccion = !String(connection.history_feed_url || '').trim();
              return (
                <div key={connection.id} className="space-y-1 rounded-xl bg-muted/40 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {connection.wholesaler_name || 'Cliente mayorista'}
                    </span>
                    {sinDireccion && <Badge className="bg-amber-100 text-amber-700">falta la dirección</Badge>}
                    {connection.history_sync_enabled === false && (
                      <Badge className="bg-slate-100 text-slate-600">desactivada</Badge>
                    )}
                    {connection.last_history_status === 'error' && (
                      <Badge className="bg-rose-100 text-rose-700">con error</Badge>
                    )}
                    {Number(connection.last_history_notified) > 0 && (
                      <Badge className="bg-emerald-100 text-emerald-700">
                        {connection.last_history_notified} devuelta(s) al mayorista
                      </Badge>
                    )}
                    {Number(connection.last_history_notify_failed) > 0 && (
                      <Badge className="bg-rose-100 text-rose-700">
                        {connection.last_history_notify_failed} aviso(s) sin entregar
                      </Badge>
                    )}
                    {Number(connection.last_history_notify_pending) > 0 && (
                      <Badge className="bg-amber-100 text-amber-700">
                        {connection.last_history_notify_pending} pendiente(s) de devolver
                      </Badge>
                    )}
                    {Number(connection.last_history_assigned) > 0 && (
                      <Badge className="bg-teal-100 text-teal-700">
                        {connection.last_history_assigned} con titular asignado
                      </Badge>
                    )}
                    <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
                      {when(connection.last_history_run_date)}
                    </span>
                  </div>
                  {connection.last_history_message && (
                    <p className="text-xs text-muted-foreground">{connection.last_history_message}</p>
                  )}
                  <WholesalerHistoryDetailList detail={connection.last_history_detail} />
                </div>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}