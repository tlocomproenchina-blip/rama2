import React from 'react';
import StalePackagesPanel from '@/components/admin/StalePackagesPanel';
import { Card, CardContent } from '@/components/ui/card';
import { FileText } from 'lucide-react';

export default function AdminPreAlerts() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 md:px-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Pre-alertas</h1>
        <p className="text-slate-500">Gestiona en un solo lugar las pre-alertas pendientes de recepción.</p>
      </div>

      <Card className="border-0 shadow-md">
        <CardContent className="p-4 flex items-center gap-3 text-slate-600">
          <div className="rounded-xl bg-amber-100 p-2">
            <FileText className="h-5 w-5 text-amber-600" />
          </div>
          <p className="text-sm">Aquí se muestran solo las pre-alertas con más de 7 días para que no ocupen espacio en el módulo general de paquetes.</p>
        </CardContent>
      </Card>

      <StalePackagesPanel />
    </div>
  );
}