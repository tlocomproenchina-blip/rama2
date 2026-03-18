import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const statusLabels = {
  trialing: 'Prueba activa',
  active: 'Activa',
  past_due: 'Pago pendiente',
  canceled: 'Cancelada',
  incomplete: 'Pendiente',
  incomplete_expired: 'Expirada',
  unpaid: 'Impaga',
};

export default function CurrentTenantSubscriptionCard({ subscription, tenantId, onManageBilling, onRefresh, loading }) {
  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-xl text-slate-900">Suscripción actual</CardTitle>
          <CardDescription>Administra el plan activo del tenant y sus pagos recurrentes.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onRefresh} disabled={loading}>Actualizar</Button>
          {subscription?.stripe_customer_id && (
            <Button onClick={onManageBilling} disabled={loading}>Gestionar facturación</Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {subscription ? (
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-slate-500">Plan</p>
              <p className="font-semibold text-slate-900">{subscription.plan_name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Estado</p>
              <Badge variant="outline">{statusLabels[subscription.status] || subscription.status}</Badge>
            </div>
            <div>
              <p className="text-sm text-slate-500">Tenant</p>
              <p className="font-medium text-slate-700">{tenantId}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Próximo corte</p>
              <p className="font-medium text-slate-700">
                {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : 'Sin fecha'}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
            Este tenant todavía no tiene una suscripción activa.
          </div>
        )}
      </CardContent>
    </Card>
  );
}