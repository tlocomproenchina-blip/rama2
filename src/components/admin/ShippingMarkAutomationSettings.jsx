import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tag } from 'lucide-react';
import ShippingMarkCodePoolManager from '@/components/admin/ShippingMarkCodePoolManager';

export default function ShippingMarkAutomationSettings({ appConfig, setAppConfig }) {
  return (
    <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 p-4 md:mt-8 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-2">
            <Tag className="h-5 w-5 text-sky-600" />
            Asignación automática de Shipping Mark
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Actívala para generar el código automáticamente al completar el registro. Si la desactivas, seguirá siendo manual desde Clientes.
          </p>
        </div>
        <Switch
          checked={!!appConfig.shipping_mark_auto_assign_enabled}
          onCheckedChange={(checked) => setAppConfig({ ...appConfig, shipping_mark_auto_assign_enabled: checked })}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Prefijo automático</Label>
          <Input
            value={appConfig.shipping_mark_auto_assign_prefix || ''}
            onChange={(e) => setAppConfig({ ...appConfig, shipping_mark_auto_assign_prefix: e.target.value })}
            placeholder="TLEC-"
          />
        </div>
        <div className="space-y-2">
          <Label>Longitud</Label>
          <Input
            type="number"
            min="1"
            value={appConfig.shipping_mark_auto_assign_length ?? 6}
            onChange={(e) => setAppConfig({ ...appConfig, shipping_mark_auto_assign_length: parseInt(e.target.value) || 6 })}
          />
        </div>
        <div className="space-y-2">
          <Label>Caracteres permitidos</Label>
          <Input
            value={appConfig.shipping_mark_auto_assign_chars || ''}
            onChange={(e) => setAppConfig({ ...appConfig, shipping_mark_auto_assign_chars: e.target.value.toUpperCase() })}
            placeholder="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
          />
        </div>
      </div>

      <ShippingMarkCodePoolManager />
    </div>
  );
}