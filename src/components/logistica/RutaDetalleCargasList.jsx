import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EstadoLogisticaBadge from '@/components/logistica/EstadoLogisticaBadge';

export default function RutaDetalleCargasList({ cargas, orderedLoadIds = [] }) {
  const orderMap = Object.fromEntries(orderedLoadIds.map((id, index) => [id, index + 1]));
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle>Cargas asignadas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {cargas.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">No hay cargas registradas en esta ruta.</div>
        ) : cargas.map((carga) => (
          <div key={carga.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-slate-900">{carga.tracking_number || carga.descripcion}</p>
                <p className="text-sm text-slate-500">{carga.cliente_email || 'Sin cliente'} · {carga.tipo_carga}</p>
                {orderMap[carga.id] && (
                  <p className="text-xs text-violet-700 mt-2">Orden sugerido: #{orderMap[carga.id]}</p>
                )}
              </div>
              <EstadoLogisticaBadge value={carga.estado_entrega} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}