import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function SubscriptionPlanCard({ plan, currentPlanCode, canStartTrial, isBusy, onSelect }) {
  const isCurrent = currentPlanCode === plan.plan_code;
  const isTrialDisabled = plan.is_trial && !canStartTrial;
  const buttonLabel = isCurrent
    ? 'Plan actual'
    : plan.is_trial
      ? 'Activar prueba gratis'
      : 'Elegir plan';

  return (
    <Card className={`border shadow-sm ${isCurrent ? 'border-blue-500 shadow-blue-100' : 'border-slate-200'}`}>
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl text-slate-900">{plan.name}</CardTitle>
            <CardDescription className="mt-1 text-sm text-slate-500">{plan.description}</CardDescription>
          </div>
          {isCurrent && <Badge className="bg-blue-600 text-white">Activo</Badge>}
          {!isCurrent && plan.discount_percentage > 0 && <Badge variant="outline">-{plan.discount_percentage}%</Badge>}
        </div>
        <div>
          <p className="text-3xl font-bold text-slate-900">${Number(plan.price || 0).toFixed(0)}</p>
          {!plan.is_trial && (
            <p className="text-sm text-slate-500">
              {plan.duration_months === 1 ? 'por mes' : `cada ${plan.duration_months} meses`} · ${Number(plan.monthly_equivalent || 0).toFixed(0)}/mes
            </p>
          )}
          {plan.is_trial && <p className="text-sm text-slate-500">Sin costo por {plan.trial_days} días</p>}
          {!plan.is_trial && Number(plan.original_price || 0) > Number(plan.price || 0) && (
            <p className="text-xs text-slate-400 line-through">Precio normal: ${Number(plan.original_price || 0).toFixed(0)}</p>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2 text-sm text-slate-600">
          {(plan.features || []).map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <Button
          className="w-full"
          variant={isCurrent ? 'outline' : 'default'}
          disabled={isCurrent || isTrialDisabled || isBusy}
          onClick={() => onSelect(plan)}
        >
          {isTrialDisabled ? 'Prueba ya utilizada' : buttonLabel}
        </Button>
      </CardContent>
    </Card>
  );
}