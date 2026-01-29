import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layers, Plane, Ship, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function ActiveConsolidationsWidget({ consolidations }) {
  const activeConsolidations = consolidations.filter(c => 
    c.status !== 'entregado'
  );

  const statusColors = {
    pendiente_pago: 'bg-yellow-100 text-yellow-800',
    pago_pendiente_validacion: 'bg-orange-100 text-orange-800',
    en_transito: 'bg-blue-100 text-blue-800',
    disponible: 'bg-green-100 text-green-800'
  };

  const statusLabels = {
    pendiente_pago: 'Pendiente Pago',
    pago_pendiente_validacion: 'Validando Pago',
    en_transito: 'En Tránsito',
    disponible: 'Disponible'
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Layers className="h-5 w-5 text-purple-600" />
          Consolidaciones Activas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activeConsolidations.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">
            No tienes consolidaciones activas
          </p>
        ) : (
          <div className="space-y-3">
            {activeConsolidations.slice(0, 3).map((consolidation) => (
              <Link
                key={consolidation.id}
                to={createPageUrl('MyConsolidations')}
                className="block p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {consolidation.shipping_type === 'aereo' ? (
                      <Plane className="h-4 w-4 text-blue-600" />
                    ) : (
                      <Ship className="h-4 w-4 text-blue-600" />
                    )}
                    <span className="font-mono text-sm font-medium">
                      {consolidation.consolidation_tracking}
                    </span>
                  </div>
                  <Badge className={statusColors[consolidation.status]}>
                    {statusLabels[consolidation.status]}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{consolidation.tracking_numbers?.length || 0} paquetes</span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    ${consolidation.total_cost?.toFixed(2)}
                  </span>
                </div>
              </Link>
            ))}
            {activeConsolidations.length > 3 && (
              <Link
                to={createPageUrl('MyConsolidations')}
                className="block text-center text-sm text-blue-600 hover:text-blue-700 font-medium pt-2"
              >
                Ver todas ({activeConsolidations.length})
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}