import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, CreditCard } from 'lucide-react';

export default function PlanCard({ plan, currentPlanCode, billingCycle, onEdit, onSubscribe }) {
  const isCurrent = currentPlanCode === plan.plan_code;
  const selectedPriceId = billingCycle === 'yearly' ? plan.stripe_price_id_yearly : plan.stripe_price_id_monthly;

  return (
    <Card className={`border-0 shadow-md ${isCurrent ? 'ring-2 ring-blue-500' : ''}`}>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-800">{plan.name}</h3>
            <p className="text-sm text-slate-500">{plan.description || 'Sin descripción'}</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            {isCurrent && <Badge className="bg-blue-100 text-blue-700">Actual</Badge>}
            {!plan.is_active && <Badge variant="outline">Inactivo</Badge>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-slate-500">Mensual</p>
            <p className="font-semibold text-slate-800">${Number(plan.monthly_price || 0).toFixed(2)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-slate-500">Anual</p>
            <p className="font-semibold text-slate-800">${Number(plan.yearly_price || 0).toFixed(2)}</p>
          </div>
        </div>
        <div className="space-y-2">
          {(plan.features || []).slice(0, 4).map((feature, index) => (
            <div key={index} className="flex items-center gap-2 text-sm text-slate-600">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>{feature}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onEdit(plan)}>Editar</Button>
          <Button disabled={!selectedPriceId} onClick={() => onSubscribe(plan)} className="flex-1 bg-slate-900 hover:bg-slate-800">
            <CreditCard className="h-4 w-4 mr-2" />Suscribir tenant
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}