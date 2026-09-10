import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Tag } from 'lucide-react';

export default function ShippingMarkAutomationSettings({ appConfig, setAppConfig }) {
  return (
    <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 p-4 md:mt-8 md:p-6">
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
    </div>
  );
}