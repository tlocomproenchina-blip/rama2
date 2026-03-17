import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function PickingOrderList({ requests, selectedRequestId, onSelect }) {
  if (!requests.length) {
    return <Card><CardContent className="p-8 text-center text-slate-500">No hay solicitudes aprobadas para preparar.</CardContent></Card>;
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => (
        <Card key={request.id} className={selectedRequestId === request.id ? 'border-blue-300 shadow-md' : 'shadow-sm'}>
          <CardContent className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="font-semibold text-slate-800">{request.shipping_mark || 'Sin shipping mark'} · {request.client_email}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{request.shipping_type}</Badge>
                <Badge variant="secondary">{(request.package_ids || request.tracking_numbers || []).length} paquetes</Badge>
              </div>
            </div>
            <Button variant={selectedRequestId === request.id ? 'default' : 'outline'} onClick={() => onSelect(request.id)}>
              {selectedRequestId === request.id ? 'Seleccionada' : 'Ver picking'}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}