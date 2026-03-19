import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EstadoLogisticaBadge from '@/components/logistica/EstadoLogisticaBadge';

const formatDate = (value) => value ? new Date(value).toLocaleString('es-VE') : '—';

export default function RutaDetalleSeguimientoList({ seguimientos }) {
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle>Seguimiento reciente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {seguimientos.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">No hay eventos de seguimiento registrados.</div>
        ) : seguimientos.map((item) => (
          <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-slate-900">{item.ubicacion || 'Sin ubicación'}</p>
                <p className="text-sm text-slate-500">{formatDate(item.fecha_hora)}</p>
                <p className="text-sm text-slate-600 mt-2">{item.comentario || 'Sin comentario'}</p>
              </div>
              <EstadoLogisticaBadge value={item.estado} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}