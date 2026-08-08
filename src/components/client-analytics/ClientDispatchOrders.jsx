import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck } from 'lucide-react';
import DispatchOrderCard from '@/components/warehouse/DispatchOrderCard';

export default function ClientDispatchOrders({ orders = [], client }) {
  const sorted = useMemo(
    () => [...orders].sort((a, b) => new Date(b.dispatched_date || b.created_date) - new Date(a.dispatched_date || a.created_date)),
    [orders]
  );

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-slate-800">
          <Truck className="h-5 w-5 text-blue-600" />
          Órdenes de Despacho ({sorted.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-6">No hay órdenes de despacho registradas para este cliente.</p>
        ) : (
          <div className="space-y-3">
            {sorted.map((order) => (
              <DispatchOrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}