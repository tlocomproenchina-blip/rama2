import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, Calendar, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, differenceInDays } from 'date-fns';

export default function DeliveryTimesWidget({ consolidations }) {
  const inTransitConsolidations = consolidations
    .filter(c => c.status === 'en_transito' && c.estimated_delivery)
    .sort((a, b) => new Date(a.estimated_delivery) - new Date(b.estimated_delivery))
    .slice(0, 3);

  const getDaysRemaining = (estimatedDate) => {
    const days = differenceInDays(new Date(estimatedDate), new Date());
    if (days < 0) return { text: 'Retrasado', color: 'text-red-600', bgColor: 'bg-red-50' };
    if (days === 0) return { text: 'Hoy', color: 'text-green-600', bgColor: 'bg-green-50' };
    if (days === 1) return { text: 'Mañana', color: 'text-orange-600', bgColor: 'bg-orange-50' };
    return { text: `${days} días`, color: 'text-blue-600', bgColor: 'bg-blue-50' };
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Truck className="h-5 w-5 text-blue-600" />
          Entregas Próximas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {inTransitConsolidations.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">
            No tienes envíos en tránsito
          </p>
        ) : (
          <div className="space-y-3">
            {inTransitConsolidations.map((consolidation) => {
              const daysInfo = getDaysRemaining(consolidation.estimated_delivery);
              return (
                <Link
                  key={consolidation.id}
                  to={createPageUrl('ShipmentTracking')}
                  className="block p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-mono text-sm font-medium text-slate-800">
                        {consolidation.consolidation_tracking}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(consolidation.estimated_delivery), 'dd/MM/yyyy')}
                      </p>
                    </div>
                    <div className={`px-3 py-1 rounded-full ${daysInfo.bgColor}`}>
                      <p className={`text-sm font-semibold ${daysInfo.color} flex items-center gap-1`}>
                        <Clock className="h-3 w-3" />
                        {daysInfo.text}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800 text-xs">
                    En tránsito
                  </Badge>
                </Link>
              );
            })}
            {consolidations.filter(c => c.status === 'en_transito').length > 3 && (
              <Link
                to={createPageUrl('ShipmentTracking')}
                className="block text-center text-sm text-blue-600 hover:text-blue-700 font-medium pt-2"
              >
                Ver todos los envíos
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}