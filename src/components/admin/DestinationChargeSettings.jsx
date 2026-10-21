import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, Truck } from 'lucide-react';
import { toast } from 'sonner';

// Configuración del cobro destino: se aplica solo a envíos marítimos y se cobra
// por cada bulto o caja consolidada cuando el cliente lo incluye en la calculadora.
export default function DestinationChargeSettings() {
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const rows = await base44.entities.DestinationCharge.filter({ config_key: 'main' });
      setConfig(rows[0] || { config_key: 'main', is_enabled: true, rate_per_bulto: 9, label: 'Cobro destino' });
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const me = await base44.auth.me();
      const payload = {
        config_key: 'main',
        is_enabled: config.is_enabled !== false,
        rate_per_bulto: Number(config.rate_per_bulto) || 0,
        label: config.label || 'Cobro destino',
        updated_by: me?.email,
      };
      if (config.id) {
        await base44.entities.DestinationCharge.update(config.id, payload);
      } else {
        const created = await base44.entities.DestinationCharge.create(payload);
        setConfig(created);
      }
      toast.success('Cobro destino guardado');
    } catch (error) {
      toast.error('No se pudo guardar el cobro destino');
    }
    setSaving(false);
  };

  if (!config) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
      </div>
    );
  }

  const rate = Number(config.rate_per_bulto) || 0;

  return (
    <Card className="rounded-2xl border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-cyan-600" />
          Cobro destino
        </CardTitle>
        <CardDescription>
          Cargo por bulto o caja consolidada que se ofrece en la calculadora de envíos marítimos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4 md:p-6">
        <div className="flex items-center justify-between rounded-xl border border-cyan-200 bg-cyan-50 p-4">
          <div>
            <p className="font-semibold text-slate-800">Mostrar en la calculadora</p>
            <p className="text-sm text-slate-600">Aplica únicamente a envíos marítimos</p>
          </div>
          <Switch
            checked={config.is_enabled !== false}
            onCheckedChange={(checked) => setConfig({ ...config, is_enabled: checked })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tarifa por bulto (USD)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={config.rate_per_bulto ?? ''}
              onChange={(e) => setConfig({ ...config, rate_per_bulto: e.target.value })}
              placeholder="9.00"
            />
          </div>
          <div className="space-y-2">
            <Label>Nombre del cargo</Label>
            <Input
              value={config.label || ''}
              onChange={(e) => setConfig({ ...config, label: e.target.value })}
              placeholder="Cobro destino"
            />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          Ejemplo: 3 bultos × ${rate.toFixed(2)} = ${(rate * 3).toFixed(2)} de cobro destino.
        </div>

        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar cobro destino
        </Button>
      </CardContent>
    </Card>
  );
}