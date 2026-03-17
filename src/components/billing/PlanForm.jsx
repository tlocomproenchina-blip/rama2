import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save } from 'lucide-react';

export default function PlanForm({ form, setForm, onSave, saving, onCancel }) {
  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <CardTitle className="text-lg">{form.id ? 'Editar plan' : 'Nuevo plan'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Nombre</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Código</Label>
          <Input value={form.plan_code} onChange={(e) => setForm({ ...form, plan_code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-') })} />
        </div>
        <div className="space-y-2">
          <Label>Descripción</Label>
          <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Precio mensual</Label>
            <Input type="number" value={form.monthly_price} onChange={(e) => setForm({ ...form, monthly_price: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Precio trimestral</Label>
            <Input type="number" value={form.quarterly_price} onChange={(e) => setForm({ ...form, quarterly_price: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Precio semestral</Label>
            <Input type="number" value={form.semiannual_price} onChange={(e) => setForm({ ...form, semiannual_price: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Precio anual</Label>
            <Input type="number" value={form.yearly_price} onChange={(e) => setForm({ ...form, yearly_price: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-2">
            <Label>Stripe price mensual</Label>
            <Input value={form.stripe_price_id_monthly} onChange={(e) => setForm({ ...form, stripe_price_id_monthly: e.target.value })} placeholder="price_..." />
          </div>
          <div className="space-y-2">
            <Label>Stripe price trimestral</Label>
            <Input value={form.stripe_price_id_quarterly} onChange={(e) => setForm({ ...form, stripe_price_id_quarterly: e.target.value })} placeholder="price_..." />
          </div>
          <div className="space-y-2">
            <Label>Stripe price semestral</Label>
            <Input value={form.stripe_price_id_semiannual} onChange={(e) => setForm({ ...form, stripe_price_id_semiannual: e.target.value })} placeholder="price_..." />
          </div>
          <div className="space-y-2">
            <Label>Stripe price anual</Label>
            <Input value={form.stripe_price_id_yearly} onChange={(e) => setForm({ ...form, stripe_price_id_yearly: e.target.value })} placeholder="price_..." />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Máx. usuarios</Label>
            <Input type="number" value={form.max_users} onChange={(e) => setForm({ ...form, max_users: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Máx. envíos/mes</Label>
            <Input type="number" value={form.max_shipments_per_month} onChange={(e) => setForm({ ...form, max_shipments_per_month: e.target.value })} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Beneficios (uno por línea)</Label>
          <textarea
            className="flex min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            value={form.features_text}
            onChange={(e) => setForm({ ...form, features_text: e.target.value })}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
          <Label>Activo</Label>
          <Switch checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} />
        </div>
        <div className="flex gap-2">
          <Button onClick={onSave} disabled={saving} className="flex-1 bg-slate-900 hover:bg-slate-800">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Guardar plan
          </Button>
          {onCancel && <Button variant="outline" onClick={onCancel}>Cancelar</Button>}
        </div>
      </CardContent>
    </Card>
  );
}