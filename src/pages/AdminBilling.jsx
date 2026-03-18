import React from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { toast } from 'sonner';
import { Loader2, Wallet } from 'lucide-react';
import CurrentTenantSubscriptionCard from '@/components/billing/CurrentTenantSubscriptionCard';
import SubscriptionPlanCard from '@/components/billing/SubscriptionPlanCard';

export default function AdminBilling() {
  const [loading, setLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [billingData, setBillingData] = React.useState({
    plans: [],
    current_subscription: null,
    can_start_trial: true,
    tenant_id: 'main',
  });

  const loadBilling = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('getTenantBillingOverview', {});
      setBillingData(response.data || {});
    } catch (error) {
      toast.error(error?.response?.data?.error || 'No se pudo cargar la facturación');
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('billing');
    if (status === 'success') toast.success('Stripe confirmó el proceso de suscripción.');
    if (status === 'cancel') toast.info('El cambio de suscripción fue cancelado.');
  }, []);

  const handleManageBilling = async () => {
    setActionLoading(true);
    try {
      const response = await base44.functions.invoke('createTenantBillingPortal', { return_url: window.location.href });
      if (response?.data?.url) {
        window.location.href = response.data.url;
        return;
      }
      toast.error('No se pudo abrir el portal de facturación');
    } catch (error) {
      toast.error(error?.response?.data?.error || 'No se pudo abrir el portal');
    }
    setActionLoading(false);
  };

  const handleSelectPlan = async (plan) => {
    setActionLoading(true);
    try {
      if (plan.is_trial) {
        await base44.functions.invoke('startTenantFreeTrial', {});
        toast.success('La prueba gratuita fue activada.');
        await loadBilling();
        setActionLoading(false);
        return;
      }

      const currentSubscription = billingData.current_subscription;
      if (currentSubscription?.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(currentSubscription.status)) {
        await base44.functions.invoke('changeTenantSubscriptionPlan', { plan_code: plan.plan_code });
        toast.success('El plan fue actualizado en Stripe Billing.');
        await loadBilling();
        setActionLoading(false);
        return;
      }

      const response = await base44.functions.invoke('createTenantCheckoutSession', {
        plan_code: plan.plan_code,
        success_url: `${window.location.origin}/AdminBilling?billing=success`,
        cancel_url: `${window.location.origin}/AdminBilling?billing=cancel`,
      });

      if (response?.data?.url) {
        window.location.href = response.data.url;
        return;
      }

      toast.error(response?.data?.error || 'No se pudo iniciar el checkout');
    } catch (error) {
      toast.error(error?.response?.data?.error || 'No se pudo cambiar el plan');
    }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
          <Wallet className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Suscripción SaaS</h1>
          <p className="text-slate-500">Gestiona el plan del tenant, su prueba gratuita y la facturación recurrente en Stripe.</p>
        </div>
      </div>

      <CurrentTenantSubscriptionCard
        subscription={billingData.current_subscription}
        tenantId={billingData.tenant_id}
        onManageBilling={handleManageBilling}
        onRefresh={loadBilling}
        loading={actionLoading || loading}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(billingData.plans || []).map((plan) => (
          <SubscriptionPlanCard
            key={plan.id || plan.plan_code}
            plan={plan}
            currentPlanCode={billingData.current_subscription?.plan_code}
            canStartTrial={billingData.can_start_trial}
            isBusy={actionLoading}
            onSelect={handleSelectPlan}
          />
        ))}
      </div>
    </div>
  );
}