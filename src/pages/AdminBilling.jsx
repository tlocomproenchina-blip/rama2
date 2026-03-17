import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Building2, CreditCard, Loader2, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import PlanForm from '@/components/billing/PlanForm';
import PlanCard from '@/components/billing/PlanCard';
import CurrentSubscriptionCard from '@/components/billing/CurrentSubscriptionCard';
import { getStoredTenantContext } from '@/lib/tenantContext';

const emptyForm = {
  id: null,
  plan_code: '',
  name: '',
  description: '',
  monthly_price: '',
  quarterly_price: '',
  semiannual_price: '',
  yearly_price: '',
  stripe_price_id_monthly: '',
  stripe_price_id_quarterly: '',
  stripe_price_id_semiannual: '',
  stripe_price_id_yearly: '',
  max_users: '',
  max_shipments_per_month: '',
  features_text: '',
  is_active: true
};

export default function AdminBilling({ user }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState([]);
  const [tenant, setTenant] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [form, setForm] = useState(emptyForm);

  const tenantContext = getStoredTenantContext();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const currentTenantId = tenantContext?.tenant_id || user?.tenant_id;
      const [planRows, tenantRows] = await Promise.all([
        base44.entities.SubscriptionPlan.list('sort_order', 100),
        base44.entities.Tenant.list('-created_date', 200)
      ]);
      const resolvedTenant = (tenantRows || []).find((item) => item.id === currentTenantId) || (tenantRows || []).find((item) => item.is_default) || (tenantRows || [])[0] || null;
      const subscriptionRows = resolvedTenant ? await base44.entities.TenantSubscription.filter({ tenant_id: resolvedTenant.id }, '-updated_date', 1) : [];
      setPlans(planRows || []);
      setTenant(resolvedTenant);
      setSubscription((subscriptionRows || [])[0] || null);
    } catch (error) {
      toast.error('No se pudo cargar la facturación SaaS');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => setForm(emptyForm);

  const currentPlanCode = subscription?.plan_code || tenant?.current_plan_code;

  const handleSeedPlans = async () => {
    try {
      setSaving(true);
      await base44.entities.SubscriptionPlan.bulkCreate([
        {
          plan_code: 'base',
          name: 'Plan Base',
          description: 'Estructura recomendada con descuentos por permanencia',
          monthly_price: 100,
          quarterly_price: 270,
          semiannual_price: 510,
          yearly_price: 960,
          max_users: 10,
          max_shipments_per_month: 1000,
          features: ['Pago flexible mensual', '10% de descuento trimestral', '15% de descuento semestral', '20% de descuento anual'],
          sort_order: 1,
          is_active: true
        }
      ]);
      toast.success('Planes base creados');
      loadData();
    } catch (error) {
      toast.error('No se pudieron crear los planes base');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePlan = async () => {
    if (!form.plan_code || !form.name) {
      toast.error('Completa nombre y código');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        plan_code: form.plan_code,
        name: form.name,
        description: form.description,
        monthly_price: Number(form.monthly_price || 0),
        quarterly_price: Number(form.quarterly_price || 0),
        semiannual_price: Number(form.semiannual_price || 0),
        yearly_price: Number(form.yearly_price || 0),
        stripe_price_id_monthly: form.stripe_price_id_monthly,
        stripe_price_id_quarterly: form.stripe_price_id_quarterly,
        stripe_price_id_semiannual: form.stripe_price_id_semiannual,
        stripe_price_id_yearly: form.stripe_price_id_yearly,
        max_users: Number(form.max_users || 0),
        max_shipments_per_month: Number(form.max_shipments_per_month || 0),
        features: form.features_text.split('\n').map((item) => item.trim()).filter(Boolean),
        is_active: form.is_active
      };

      if (form.id) {
        await base44.entities.SubscriptionPlan.update(form.id, payload);
        toast.success('Plan actualizado');
      } else {
        await base44.entities.SubscriptionPlan.create(payload);
        toast.success('Plan creado');
      }

      resetForm();
      loadData();
    } catch (error) {
      toast.error('No se pudo guardar el plan');
    } finally {
      setSaving(false);
    }
  };

  const handleEditPlan = (plan) => {
    setForm({
      id: plan.id,
      plan_code: plan.plan_code || '',
      name: plan.name || '',
      description: plan.description || '',
      monthly_price: plan.monthly_price ?? '',
      quarterly_price: plan.quarterly_price ?? '',
      semiannual_price: plan.semiannual_price ?? '',
      yearly_price: plan.yearly_price ?? '',
      stripe_price_id_monthly: plan.stripe_price_id_monthly || '',
      stripe_price_id_quarterly: plan.stripe_price_id_quarterly || '',
      stripe_price_id_semiannual: plan.stripe_price_id_semiannual || '',
      stripe_price_id_yearly: plan.stripe_price_id_yearly || '',
      max_users: plan.max_users ?? '',
      max_shipments_per_month: plan.max_shipments_per_month ?? '',
      features_text: (plan.features || []).join('\n'),
      is_active: plan.is_active !== false
    });
  };

  const handleSubscribe = async (plan) => {
    try {
      setSaving(true);
      const response = await base44.functions.invoke('createTenantSubscriptionCheckout', {
        planCode: plan.plan_code,
        planName: plan.name,
        priceId: billingCycle === 'quarterly'
          ? plan.stripe_price_id_quarterly
          : billingCycle === 'semiannual'
            ? plan.stripe_price_id_semiannual
            : billingCycle === 'yearly'
              ? plan.stripe_price_id_yearly
              : plan.stripe_price_id_monthly,
        billingCycle,
        returnUrl: `${window.location.origin}${createPageUrl('AdminBilling')}`
      });
      if (response?.data?.url) {
        window.location.href = response.data.url;
        return;
      }
      toast.error(response?.data?.error || 'No se pudo iniciar Stripe Checkout');
    } catch (error) {
      toast.error('No se pudo iniciar la suscripción');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPortal = async () => {
    try {
      setSaving(true);
      const response = await base44.functions.invoke('createTenantBillingPortal', {
        returnUrl: `${window.location.origin}${createPageUrl('AdminBilling')}`
      });
      if (response?.data?.url) {
        window.location.href = response.data.url;
        return;
      }
      toast.error(response?.data?.error || 'No se pudo abrir el portal');
    } catch (error) {
      toast.error('No se pudo abrir el portal de facturación');
    } finally {
      setSaving(false);
    }
  };

  const activePlans = useMemo(() => plans.filter((plan) => plan.is_active !== false), [plans]);

  if (user?.role !== 'admin') {
    return <Card className="border-0 shadow-md"><CardContent className="p-8 text-center text-slate-500">Solo administradores pueden gestionar la suscripción SaaS.</CardContent></Card>;
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><CreditCard className="h-6 w-6 text-blue-600" />Facturación SaaS</h1>
          <p className="text-slate-500">Configura planes, suscribe el tenant activo y administra su portal de facturación.</p>
        </div>
        <Button variant="outline" onClick={loadData}><RefreshCw className="h-4 w-4 mr-2" />Actualizar</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-md"><CardContent className="p-5"><p className="text-sm text-slate-500">Tenant activo</p><p className="text-lg font-semibold text-slate-800 truncate">{tenant?.name || tenantContext?.tenant_name || 'Sin tenant seleccionado'}</p></CardContent></Card>
        <Card className="border-0 shadow-md"><CardContent className="p-5"><p className="text-sm text-slate-500">Planes activos</p><p className="text-3xl font-bold text-slate-800">{activePlans.length}</p></CardContent></Card>
        <Card className="border-0 shadow-md"><CardContent className="p-5"><p className="text-sm text-slate-500">Plan actual</p><p className="text-lg font-semibold text-slate-800 truncate">{subscription?.plan_name || tenant?.current_plan_name || 'Sin plan'}</p></CardContent></Card>
      </div>

      <CurrentSubscriptionCard tenant={tenant} subscription={subscription} onOpenPortal={handleOpenPortal} />

      <Card className="border-0 shadow-md bg-slate-50">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3 md:items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-slate-600" />
            <div>
              <p className="font-medium text-slate-800">Ciclo a usar en el próximo checkout</p>
              <p className="text-sm text-slate-500">Elige mensual o anual antes de suscribir el tenant actual.</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant={billingCycle === 'monthly' ? 'default' : 'outline'} onClick={() => setBillingCycle('monthly')}>Mensual</Button>
            <Button variant={billingCycle === 'quarterly' ? 'default' : 'outline'} onClick={() => setBillingCycle('quarterly')}>Trimestral</Button>
            <Button variant={billingCycle === 'semiannual' ? 'default' : 'outline'} onClick={() => setBillingCycle('semiannual')}>Semestral</Button>
            <Button variant={billingCycle === 'yearly' ? 'default' : 'outline'} onClick={() => setBillingCycle('yearly')}>Anual</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <PlanForm form={form} setForm={setForm} onSave={handleSavePlan} saving={saving} onCancel={form.id ? resetForm : null} />
          {plans.length === 0 && (
            <Button onClick={handleSeedPlans} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}Crear planes base
            </Button>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Catálogo de planes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                Para que Checkout funcione, cada plan debe tener sus Price IDs de Stripe configurados.
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} billingCycle={billingCycle} currentPlanCode={currentPlanCode} onEdit={handleEditPlan} onSubscribe={handleSubscribe} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}