import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Boxes, Building2, FileText, Package, PackageCheck, Users } from 'lucide-react';

function Metric({ icon: Icon, label, value }) {
  return (
    <Card className="border-border/70 shadow-card">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-semibold text-foreground">{value}</p>
        </div>
        <Icon className="h-5 w-5 shrink-0 text-primary" />
      </CardContent>
    </Card>
  );
}

export default function DispatchOrderSummaryCards({ sheet }) {
  const totals = sheet?.totals || {};
  const metrics = [
    { icon: FileText, label: 'Facturas pagadas', value: totals.invoices || 0 },
    { icon: Users, label: 'Clientes', value: totals.clients || 0 },
    { icon: Building2, label: 'Ciudades', value: totals.cities || 0 },
    { icon: Boxes, label: 'Cajas consolidadas', value: totals.cajas || 0 },
    { icon: Package, label: 'Bultos sueltos', value: totals.bultos_sueltos || 0 },
    { icon: PackageCheck, label: 'Total unidades', value: totals.total_unidades || 0 },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {metrics.map((metric) => (
        <Metric key={metric.label} icon={metric.icon} label={metric.label} value={metric.value} />
      ))}
    </div>
  );
}