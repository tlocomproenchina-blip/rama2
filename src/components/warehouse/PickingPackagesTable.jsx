import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import StatusBadge from '@/components/StatusBadge';

export default function PickingPackagesTable({ packages, selectedPackageIds, onToggleAll, onToggleOne }) {
  const allSelected = packages.length > 0 && selectedPackageIds.length === packages.length;

  return (
    <Card className="shadow-sm overflow-hidden">
      <CardHeader>
        <CardTitle>Paquetes a preparar</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="md:hidden divide-y">
          <div className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-600">
            <Checkbox checked={allSelected} onCheckedChange={onToggleAll} />
            <span>Seleccionar todos</span>
          </div>
          {packages.map((pkg) => (
            <div key={pkg.id} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <Checkbox checked={selectedPackageIds.includes(pkg.id)} onCheckedChange={(checked) => onToggleOne(pkg.id, checked)} />
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <div className="font-medium text-slate-800 break-all">{pkg.tracking_number}</div>
                    <div className="text-xs text-slate-500 break-words">{pkg.description || 'Sin descripción'}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{pkg.warehouse_location_code || 'Sin ubicar'}</Badge>
                    <Badge variant="secondary">{pkg.warehouse_zone || 'Sin zona'}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <StatusBadge status={pkg.status} size="sm" />
                    <span>{pkg.actual_weight_kg || 0} kg</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="py-3 pr-3 pl-6"><Checkbox checked={allSelected} onCheckedChange={onToggleAll} /></th>
                <th className="py-3 pr-3">Tracking</th>
                <th className="py-3 pr-3">Ubicación</th>
                <th className="py-3 pr-3">Zona</th>
                <th className="py-3 pr-3">Estado</th>
                <th className="py-3 pr-6">Peso</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.id} className="border-b last:border-b-0">
                  <td className="py-3 pr-3 pl-6"><Checkbox checked={selectedPackageIds.includes(pkg.id)} onCheckedChange={(checked) => onToggleOne(pkg.id, checked)} /></td>
                  <td className="py-3 pr-3">
                    <div className="font-medium text-slate-800">{pkg.tracking_number}</div>
                    <div className="text-xs text-slate-500">{pkg.description || 'Sin descripción'}</div>
                  </td>
                  <td className="py-3 pr-3"><Badge variant="outline">{pkg.warehouse_location_code || 'Sin ubicar'}</Badge></td>
                  <td className="py-3 pr-3">{pkg.warehouse_zone || '—'}</td>
                  <td className="py-3 pr-3"><StatusBadge status={pkg.status} size="sm" /></td>
                  <td className="py-3 pr-6">{pkg.actual_weight_kg || 0} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}