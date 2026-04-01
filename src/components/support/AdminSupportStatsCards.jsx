import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, AlertCircle, Clock, CheckCircle2, UserCheck } from 'lucide-react';

export default function AdminSupportStatsCards({ tickets }) {
  const total = tickets.length;
  const abiertos = tickets.filter((t) => t.status === 'abierto').length;
  const enProceso = tickets.filter((t) => t.status === 'en_proceso').length;
  const resueltos = tickets.filter((t) => t.status === 'resuelto').length;
  const sinAsignar = tickets.filter((t) => !t.assigned_to).length;

  const items = [
    { label: 'Total', value: total, icon: MessageSquare, valueClass: 'text-slate-800', iconClass: 'text-slate-400' },
    { label: 'Abiertos', value: abiertos, icon: AlertCircle, valueClass: 'text-blue-600', iconClass: 'text-blue-400' },
    { label: 'En Proceso', value: enProceso, icon: Clock, valueClass: 'text-yellow-600', iconClass: 'text-yellow-400' },
    { label: 'Resueltos', value: resueltos, icon: CheckCircle2, valueClass: 'text-green-600', iconClass: 'text-green-400' },
    { label: 'Sin Asignar', value: sinAsignar, icon: UserCheck, valueClass: 'text-orange-600', iconClass: 'text-orange-400' }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label} className="border-0 shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">{item.label}</p>
                  <p className={`text-2xl font-bold ${item.valueClass}`}>{item.value}</p>
                </div>
                <Icon className={`h-8 w-8 ${item.iconClass}`} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}