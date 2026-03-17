import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarDays, CreditCard, ExternalLink } from 'lucide-react';

export default function CurrentSubscriptionCard({ tenant, subscription, onOpenPortal }) {
  const status = subscription?.status || tenant?.subscription_status || 'none';
  const planName = subscription?.plan_name || tenant?.current_plan_name || 'Sin plan activo';
  const periodEnd = subscription?.current_period_end || tenant?.subscription_current_period_end;

  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <CardTitle className="text-lg">Suscripción actual</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm text-slate-500">Plan activo</p>
            <p className="text-xl font-semibold text-slate-800">{planName}</p>
          </div>
          <Badge className="bg-slate-100 text-slate-800">{status}</Badge>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-sm text-slate-500">Ciclo</p>
            <p className="font-medium text-slate-800">{subscription?.billing_cycle || tenant?.subscription_billing_cycle || '—'}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-sm text-slate-500">Renovación / fin de período</p>
            <p className="font-medium text-slate-800">{periodEnd ? new Date(periodEnd).toLocaleDateString() : '—'}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onOpenPortal} disabled={!tenant?.stripe_customer_id}>
            <ExternalLink className="h-4 w-4 mr-2" />Portal de facturación
          </Button>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <CreditCard className="h-4 w-4" />
            <CalendarDays className="h-4 w-4" />
            Administra pagos, método y cancelación desde Stripe.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}