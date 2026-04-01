import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export default function PendingShippingMarkCard() {
  return (
    <Card className="border-amber-200/70 bg-amber-50/90 shadow-card">
      <CardContent className="p-4 lg:p-6">
        <div className="flex items-start gap-3 lg:gap-4">
          <div className="p-2.5 lg:p-3 bg-amber-100 rounded-xl flex-shrink-0">
            <AlertTriangle className="h-5 w-5 lg:h-6 lg:w-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-amber-800 text-sm lg:text-base">Shipping Mark Pendiente</h3>
            <p className="text-amber-700 text-xs lg:text-sm mt-1">
              Tu perfil está completo. Un administrador te asignará tu Shipping Mark pronto.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}