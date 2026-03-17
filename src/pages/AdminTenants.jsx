import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Loader2, Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import TenantForm from '@/components/admin-tenants/TenantForm';
import TenantCard from '@/components/admin-tenants/TenantCard';
import { DEFAULT_TENANT_ID, DEFAULT_TENANT_NAME, DEFAULT_TENANT_SLUG, getFallbackTenantContext, getStoredTenantContext, persistTenantContext } from '@/lib/tenantContext';

const emptyForm = {
  id: null,
  name: '',
  slug: '',
  owner_email: '',
  brand_logo_url: '',
  is_active: true,
  is_default: false
};

export default function AdminTenants({ user }) {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [activeTenantId, setActiveTenantId] = useState(getStoredTenantContext()?.tenant_id || getFallbackTenantContext().tenant_id);

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      setLoading(true);
      let rows = await base44.entities.Tenant.list('-created_date', 200);
      const hasLegacy = rows.some((tenant) => tenant.slug === DEFAULT_TENANT_SLUG || tenant.id === DEFAULT_TENANT_ID || tenant.is_default);

      if (!hasLegacy) {
        await base44.entities.Tenant.create({
          name: DEFAULT_TENANT_NAME,
          slug: DEFAULT_TENANT_SLUG,
          owner_email: user?.email,
          is_default: true,
          is_active: true
        });
        rows = await base44.entities.Tenant.list('-created_date', 200);
      }

      setTenants(rows);
      const stored = getStoredTenantContext();
      setActiveTenantId(stored?.tenant_id || rows.find((tenant) => tenant.is_default)?.id || rows[0]?.id || DEFAULT_TENANT_ID);
    } catch (error) {
      toast.error('No se pudieron cargar los tenants');
    } finally {
      setLoading(false);
    }
  };

  const filteredTenants = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tenants;
    return tenants.filter((tenant) =>
      [tenant.name, tenant.slug, tenant.owner_email].some((value) => String(value || '').toLowerCase().includes(query))
    );
  }, [tenants, search]);

  const tenantStats = useMemo(() => ({
    total: tenants.length,
    active: tenants.filter((tenant) => tenant.is_active).length,
    current: tenants.find((tenant) => tenant.id === activeTenantId)?.name || user?.tenant_name || DEFAULT_TENANT_NAME
  }), [tenants, activeTenantId, user]);

  const resetForm = () => setForm(emptyForm);

  const handleEdit = (tenant) => setForm({
    id: tenant.id,
    name: tenant.name || '',
    slug: tenant.slug || '',
    owner_email: tenant.owner_email || '',
    brand_logo_url: tenant.brand_logo_url || '',
    is_active: tenant.is_active !== false,
    is_default: !!tenant.is_default
  });

  const handleSave = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error('Completa nombre y slug');
      return;
    }

    const duplicated = tenants.find((tenant) => tenant.slug === form.slug && tenant.id !== form.id);
    if (duplicated) {
      toast.error('Ese slug ya existe');
      return;
    }

    try {
      setSaving(true);
      if (form.is_default) {
        await Promise.all(
          tenants
            .filter((tenant) => tenant.is_default && tenant.id !== form.id)
            .map((tenant) => base44.entities.Tenant.update(tenant.id, { is_default: false }))
        );
      }

      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        owner_email: form.owner_email.trim(),
        brand_logo_url: form.brand_logo_url.trim(),
        is_active: form.is_active,
        is_default: form.is_default
      };

      if (form.id) {
        await base44.entities.Tenant.update(form.id, payload);
        toast.success('Tenant actualizado');
      } else {
        await base44.entities.Tenant.create(payload);
        toast.success('Tenant creado');
      }

      resetForm();
      loadTenants();
    } catch (error) {
      toast.error('No se pudo guardar el tenant');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectTenant = async (tenant) => {
    try {
      setSaving(true);
      const context = {
        tenant_id: tenant.id,
        tenant_slug: tenant.slug,
        tenant_name: tenant.name
      };
      persistTenantContext(context);
      await base44.auth.updateMe(context);
      toast.success(`Ahora estás trabajando en ${tenant.name}`);
      setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      toast.error('No se pudo cambiar el tenant activo');
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="p-8 text-center text-slate-500">Solo administradores pueden gestionar tenants.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Building2 className="h-6 w-6 text-blue-600" />
          Gestión de Tenants
        </h1>
        <p className="text-slate-500">Crea empresas, edítalas y cambia el tenant activo para administrar sus datos y roles.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-md"><CardContent className="p-5"><p className="text-sm text-slate-500">Total tenants</p><p className="text-3xl font-bold text-slate-800">{tenantStats.total}</p></CardContent></Card>
        <Card className="border-0 shadow-md"><CardContent className="p-5"><p className="text-sm text-slate-500">Tenants activos</p><p className="text-3xl font-bold text-slate-800">{tenantStats.active}</p></CardContent></Card>
        <Card className="border-0 shadow-md"><CardContent className="p-5"><p className="text-sm text-slate-500">Tenant actual</p><p className="text-lg font-semibold text-slate-800 truncate">{tenantStats.current}</p></CardContent></Card>
      </div>

      <Card className="border-0 shadow-md bg-blue-50">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <p className="font-medium text-slate-800">Roles y permisos ya quedan separados por tenant.</p>
            <p className="text-sm text-slate-600">Al cambiar el tenant activo, la pantalla de roles y las demás vistas administrativas trabajarán sobre esa empresa.</p>
          </div>
          <Badge className="bg-white text-blue-700 border border-blue-200 w-fit">Fase 2</Badge>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <TenantForm form={form} setForm={setForm} onSubmit={handleSave} saving={saving} isEditing={!!form.id} />
          {form.id && (
            <Button variant="outline" className="w-full mt-3" onClick={resetForm}>Cancelar edición</Button>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Directorio de tenants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, slug o email" className="pl-10" />
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
          ) : filteredTenants.length === 0 ? (
            <Card className="border-0 shadow-md"><CardContent className="p-10 text-center text-slate-500">No hay tenants para mostrar.</CardContent></Card>
          ) : (
            <div className="grid gap-4">
              {filteredTenants.map((tenant) => (
                <TenantCard
                  key={tenant.id}
                  tenant={tenant}
                  isCurrent={tenant.id === activeTenantId}
                  onEdit={handleEdit}
                  onSelect={handleSelectTenant}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}