import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EstadoLogisticaBadge from '@/components/logistica/EstadoLogisticaBadge';

const formatDate = (value) => value ? new Date(value).toLocaleString('es-VE') : '—';

export default function RutaDetalleResumen({ ruta, metrics, ultimoSeguimiento }) {
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{ruta.codigo_ruta}</CardTitle>
            <p className="text-sm text-slate-500 mt-1">{ruta.origen} → {ruta.destino}</p>
          </div>
          <EstadoLogisticaBadge value={ruta.estado} />
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
        <div><span className="font-medium text-slate-800">Chofer:</span> {ruta.chofer_nombre || 'Sin asignar'}</div>
        <div><span className="font-medium text-slate-800">Vehículo:</span> {ruta.vehiculo_placa || 'Sin asignar'}</div>
        <div><span className="font-medium text-slate-800">Salida:</span> {formatDate(ruta.fecha_salida)}</div>
        <div><span className="font-medium text-slate-800">Entrega estimada:</span> {formatDate(ruta.fecha_estimada_entrega)}</div>
        <div><span className="font-medium text-slate-800">Cargas:</span> {metrics.totalCargas}</div>
        <div><span className="font-medium text-slate-800">Pendientes:</span> {metrics.pendientes}</div>
        <div><span className="font-medium text-slate-800">Completadas:</span> {metrics.completadas}</div>
        <div><span className="font-medium text-slate-800">Último avance:</span> {ultimoSeguimiento?.estado ? String(ultimoSeguimiento.estado).replaceAll('_', ' ') : 'Sin registros'}</div>
        <div className="md:col-span-2"><span className="font-medium text-slate-800">Última ubicación:</span> {ultimoSeguimiento?.ubicacion || '—'}</div>
      </CardContent>
    </Card>
  );
}