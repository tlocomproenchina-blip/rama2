import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Save } from 'lucide-react';

export default function TenantForm({ form, setForm, onSubmit, saving, isEditing }) {
  return (
    <Card className="shadow-md border-0">
      <CardHeader>
        <CardTitle className="text-lg">{isEditing ? 'Editar tenant' : 'Nuevo tenant'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Nombre</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: TLEC Express" />
        </div>
        <div className="space-y-2">
          <Label>Slug</Label>
          <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} placeholder="Ej: tlec-express" />
        </div>
        <div className="space-y-2">
          <Label>Email responsable</Label>
          <Input value={form.owner_email} onChange={(e) => setForm({ ...form, owner_email: e.target.value })} placeholder="admin@empresa.com" />
        </div>
        <div className="space-y-2">
          <Label>Logo URL</Label>
          <Input value={form.brand_logo_url} onChange={(e) => setForm({ ...form, brand_logo_url: e.target.value })} placeholder="https://..." />
        </div>
        <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <Label>Activo</Label>
            <Switch checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label>Tenant principal</Label>
            <Switch checked={form.is_default} onCheckedChange={(checked) => setForm({ ...form, is_default: checked })} />
          </div>
        </div>
        <Button onClick={onSubmit} disabled={saving} className="w-full bg-slate-900 hover:bg-slate-800">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : isEditing ? <Save className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          {isEditing ? 'Guardar tenant' : 'Crear tenant'}
        </Button>
      </CardContent>
    </Card>
  );
}