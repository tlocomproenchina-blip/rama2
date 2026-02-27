import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PaymentMethodsSettings({ onSaved }) {
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const fields = [
    { key: 'payments_enable_stripe', label: 'Stripe (tarjeta)' },
    { key: 'payments_enable_binance', label: 'Binance' },
    { key: 'payments_enable_usdt_trc20', label: 'USDT TRC20' },
    { key: 'payments_enable_paypal', label: 'PayPal' },
    { key: 'payments_enable_debito_internacional', label: 'Débito Internacional' },
    { key: 'payments_enable_wally', label: 'Wally' },
    { key: 'payments_enable_zinli', label: 'Zinli' },
    { key: 'payments_enable_wise', label: 'Wise' },
    { key: 'payments_enable_skrill', label: 'Skrill' },
    { key: 'payments_enable_pago_movil_usdt', label: 'Pago Móvil → USDT' },
  ];

  useEffect(() => {
    (async () => {
      const cfgs = await base44.entities.AppConfig.filter({ config_key: 'main' });
      if (cfgs.length > 0) setConfig(cfgs[0]);
      else setConfig({ config_key: 'main' });
      setLoading(false);
    })();
  }, []);

  const toggle = (key) => setConfig((c) => ({ ...c, [key]: !(c?.[key] ?? true) }));

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      if (config.id) await base44.entities.AppConfig.update(config.id, config);
      else {
        const created = await base44.entities.AppConfig.create(config);
        setConfig(created);
      }
      toast.success('Métodos de pago actualizados');
      onSaved?.(config);
    } catch (e) {
      toast.error('No se pudieron guardar los cambios');
      console.error(e);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" />
      </div>
    );
  }

  return (
    <Card className="border-0 shadow-none">
      <CardContent className="p-0 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {fields.map((f) => (
            <div key={f.key} className="flex items-center justify-between p-3 border rounded-lg">
              <span className="text-sm text-slate-700">{f.label}</span>
              <Switch checked={config?.[f.key] !== false} onCheckedChange={() => toggle(f.key)} />
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando...</> : 'Guardar cambios'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}