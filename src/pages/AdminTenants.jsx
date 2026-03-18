import React from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Building2, Loader2, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import TenantForm from '@/components/admin/TenantForm';

function slugify(value = '') {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

export default function AdminTenants() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [tenants, setTenants] = React.useState([]);
  const [subscriptions, setSubscriptions] = React.useState([]);
  const [editingTenant, setEditingTenant] = React.useState(null);
  const [showForm, setShowForm] = React.useState(false);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [tenantList, subscriptionList] = await Promise.all([
        base44.entities.Tenant.list('name', 200),
        base44.entities.TenantSubscription.list('-updated_date', 200),
      ]);
      setTenants(tenantList || []);
      setSubscriptions(subscriptionList || []);
    } catch (error) {
      toast.error('No se pudieron cargar los tenants');
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const enrichedTenants = React.useMemo(() => {
    return (tenants || []).map((tenant) => {
      const subscription = (subscriptions || []).find((item) => item.tenant_id === tenant.tenant_id);
      return {
        ...tenant,
        subscription_status: subscription?.status || null,
        subscription_plan: subscription?.plan_name || tenant.current_plan_code || 'Sin plan',
      };
    });
  }, [tenants, subscriptions]);

  const filteredTenants = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return enrichedTenants;
    return enrichedTenants.filter((tenant) =>
      [tenant.name, tenant.tenant_id, tenant.owner_email, tenant.billing_email, tenant.subscription_plan]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [enrichedTenants, search]);

  const handleSubmit = async (formData) => {
    setSaving(true);
    try {
      const payload = {
        ...formData,
        tenant_id: formData.tenant_id || slugify(formData.name),
        slug: formData.slug || slugify(formData.name),
      };

      if (editingTenant?.id) {
        await base44.entities.Tenant.update(editingTenant.id, payload);
        toast.success('Tenant actualizado');
      } else {
        await base44.entities.Tenant.create(payload);
        toast.success('Tenant creado');
      }

      setEditingTenant(null);
      setShowForm(false);
      await loadData();
    } catch (error) {
      toast.error('No se pudo guardar el tenant');
    }
    setSaving(false);
  };

  const handleEdit = (tenant) => {
    setEditingTenant(tenant);
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingTenant(null);
    setShowForm(true);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Gestión de Tenants</h1>
            <p className="text-slate-500">Administra tenants, responsables, branding y estado operativo.</p>
          </div>
        </div>
        <Button onClick={handleNew} className="gap-2"><Plus className="h-4 w-4" /> Nuevo tenant</Button>
      </div>

      {showForm && (
        <TenantForm
          tenant={editingTenant}
          saving={saving}
          onSubmit={handleSubmit}
          onCancel={() => {
            setEditingTenant(null);
            setShowForm(false);
          }}
        />
      )}

      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle>Listado de tenants</CardTitle>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar tenant, email o plan" className="pl-10" />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
          ) : filteredTenants.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">No hay tenants registrados.</div>
          ) : (
            <div className="space-y-3">
              {filteredTenants.map((tenant) => (
                <div key={tenant.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-900">{tenant.name}</h3>
                        <Badge variant="outline">{tenant.tenant_id}</Badge>
                        <Badge className={tenant.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>{tenant.status}</Badge>
                      </div>
                      <p className="text-sm text-slate-500">Owner: {tenant.owner_email || 'Sin definir'} · Billing: {tenant.billing_email || 'Sin definir'}</p>
                      <p className="text-sm text-slate-600">Plan: {tenant.subscription_plan}</p>
                      {tenant.notes && <p className="text-sm text-slate-500">{tenant.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={() => handleEdit(tenant)}>Editar</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}