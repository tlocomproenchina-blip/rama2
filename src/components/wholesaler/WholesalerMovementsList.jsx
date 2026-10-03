import React from 'react';
import moment from 'moment';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const tones = {
  cliente_nuevo: 'bg-emerald-100 text-emerald-700',
  cliente_existente: 'bg-sky-100 text-sky-700',
  cliente_error: 'bg-rose-100 text-rose-700',
  prealerta_reportada: 'bg-indigo-100 text-indigo-700',
  prealerta_duplicada: 'bg-slate-100 text-slate-600',
  prealerta_rechazada: 'bg-amber-100 text-amber-700',
  recepcion: 'bg-emerald-100 text-emerald-700',
  recepcion_existente: 'bg-slate-100 text-slate-600',
  no_registrado: 'bg-amber-100 text-amber-700',
  consulta: 'bg-slate-100 text-slate-600',
  aviso_enviado: 'bg-emerald-100 text-emerald-700',
  aviso_fallido: 'bg-rose-100 text-rose-700',
  informe_enviado: 'bg-emerald-100 text-emerald-700',
  informe_fallido: 'bg-rose-100 text-rose-700',
  sync_fallido: 'bg-rose-100 text-rose-700',
};

const labels = {
  cliente_nuevo: 'Cliente nuevo',
  cliente_existente: 'Cliente existente',
  cliente_error: 'Error de cliente',
  prealerta_reportada: 'Pre-alerta reportada',
  prealerta_duplicada: 'Pre-alerta duplicada',
  prealerta_rechazada: 'Pre-alerta rechazada',
  recepcion: 'Recibido en China',
  recepcion_existente: 'Ya estaba recibido',
  no_registrado: 'No registrado',
  consulta: 'Consulta',
  aviso_enviado: 'Aviso enviado',
  aviso_fallido: 'Aviso fallido',
  informe_enviado: 'Informe enviado',
  informe_fallido: 'Informe fallido',
  sync_fallido: 'Consulta fallida',
};

export default function WholesalerMovementsList({ logs = [], loading }) {
  if (loading) {
    return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>;
  }

  if (!logs.length) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Todavía no hay movimientos registrados con la app del mayorista.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <Card key={log.id} className="rounded-xl border-0 shadow-sm">
          <CardContent className="flex flex-wrap items-center gap-2 p-3 text-sm">
            <Badge className={tones[log.event_type] || 'bg-slate-100 text-slate-600'}>
              {labels[log.event_type] || log.event_type}
            </Badge>
            {log.tracking_number && <span className="font-mono text-xs text-foreground">{log.tracking_number}</span>}
            {log.shipping_mark && <span className="text-xs text-muted-foreground">{log.shipping_mark}</span>}
            {log.client_email && <span className="text-xs text-muted-foreground">{log.client_email}</span>}
            <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
              {log.event_date ? moment(log.event_date).format('DD/MM/YYYY HH:mm') : ''}
            </span>
            {log.detail && <p className="w-full text-xs text-muted-foreground">{log.detail}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}