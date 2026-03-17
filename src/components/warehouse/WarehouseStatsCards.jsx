import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Activity, Boxes, Package, ClipboardList } from 'lucide-react';

const items = [
  { key: 'active_locations', label: 'Ubicaciones activas', icon: Boxes, color: 'text-blue-600 bg-blue-100' },
  { key: 'occupied_locations', label: 'Ubicaciones ocupadas', icon: Activity, color: 'text-amber-600 bg-amber-100' },
  { key: 'assigned_packages', label: 'Paquetes ubicados', icon: Package, color: 'text-emerald-600 bg-emerald-100' },
  { key: 'approved_requests', label: 'Solicitudes aprobadas', icon: ClipboardList, color: 'text-purple-600 bg-purple-100' },
];

export default function WarehouseStatsCards({ stats }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.key} className="shadow-sm">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{item.label}</p>
                <p className="text-3xl font-bold text-slate-800">{stats?.[item.key] || 0}</p>
              </div>
              <div className={`rounded-2xl p-3 ${item.color}`}>
                <Icon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}