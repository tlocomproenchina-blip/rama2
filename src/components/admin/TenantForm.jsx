import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EMPTY_TENANT = {
  tenant_id: '',
  name: '',
  slug: '',
  status: 'draft',
  is_active: true,
  owner_email: '',
  billing_email: '',
  current_plan_code: '',
  app_name: '',
  app_logo_url: '',
  primary_color: '',
  notes: '',
};

export default function TenantForm({ tenant, saving, onSubmit, onCancel }) {
  const [form, setForm] = React.useState(tenant || EMPTY_TENANT);

  React.useEffect(() => {
    setForm(tenant || EMPTY_TENANT);
  }, [tenant]);

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle>{tenant?.id ? 'Editar tenant' : 'Nuevo tenant'}</CardTitle>
        <CardDescription>Define la identidad, estado y datos base de cada tenant.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Tenant ID</Label>
            <Input value={form.tenant_id} onChange={(e) => updateField('tenant_id', e.target.value)} placeholder="acme-main" required />
          </div>
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Acme Logistics" required />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input value={form.slug || ''} onChange={(e) => updateField('slug', e.target.value)} placeholder="acme-logistics" />
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={form.status} onValueChange={(value) => updateField('status', value)}>
              <SelectTrigger><SelectValue placeholder="Selecciona estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Borrador</SelectItem>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="trialing">Prueba</SelectItem>
                <SelectItem value="suspended">Suspendido</SelectItem>
                <SelectItem value="archived">Archivado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Owner email</Label>
            <Input value={form.owner_email || ''} onChange={(e) => updateField('owner_email', e.target.value)} placeholder="owner@empresa.com" />
          </div>
          <div className="space-y-2">
            <Label>Billing email</Label>
            <Input value={form.billing_email || ''} onChange={(e) => updateField('billing_email', e.target.value)} placeholder="billing@empresa.com" />
          </div>
          <div className="space-y-2">
            <Label>Plan actual</Label>
            <Input value={form.current_plan_code || ''} onChange={(e) => updateField('current_plan_code', e.target.value)} placeholder="annual_960" />
          </div>
          <div className="space-y-2">
            <Label>Nombre app</Label>
            <Input value={form.app_name || ''} onChange={(e) => updateField('app_name', e.target.value)} placeholder="Portal Acme" />
          </div>
          <div className="space-y-2">
            <Label>Logo URL</Label>
            <Input value={form.app_logo_url || ''} onChange={(e) => updateField('app_logo_url', e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label>Color principal</Label>
            <Input value={form.primary_color || ''} onChange={(e) => updateField('primary_color', e.target.value)} placeholder="#1c3f82" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Notas</Label>
            <Textarea value={form.notes || ''} onChange={(e) => updateField('notes', e.target.value)} placeholder="Notas internas del tenant" rows={4} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 md:col-span-2">
            <div>
              <p className="text-sm font-medium text-slate-800">Tenant habilitado</p>
              <p className="text-xs text-slate-500">Controla si el tenant está disponible para operar.</p>
            </div>
            <Switch checked={!!form.is_active} onCheckedChange={(checked) => updateField('is_active', checked)} />
          </div>
          <div className="flex gap-3 md:col-span-2">
            <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : tenant?.id ? 'Guardar cambios' : 'Crear tenant'}</Button>
            {tenant && <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}