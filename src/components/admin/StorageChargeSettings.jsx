import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, Warehouse } from 'lucide-react';
import { toast } from 'sonner';

export const STORAGE_CONFIG_DEFAULTS = {
  config_key: 'main',
  is_active: true,
  free_days: 7,
  max_days: 45,
  standard_daily_rate: 10,
  large_daily_rate: 20,
  forklift_fee: 150,
  standard_max_cbm: 0.027,
  large_if_multiple_packages: true,
  default_category: 'estandar',
  fallback_unit_per_order: true,
  notify_client: true,
  skip_threshold_days: true,
};

// Tarifas y reglas del contrato de almacenamiento y custodia: días 1 al 7 gratis,
// desde el día 8 el cargo diario por bulto y el recargo único de montacargas.
export default function StorageChargeSettings() {
  const [config, setConfig] = useState(null);
  const [configId, setConfigId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.entities.StorageChargeConfig.filter({ config_key: 'main' }, { limit: 1 });
      const found = Array.isArray(res) ? res[0] : res?.items?.[0];
      if (found) {
        setConfig({ ...STORAGE_CONFIG_DEFAULTS, ...found });
        setConfigId(found.id);
      } else {
        setConfig({ ...STORAGE_CONFIG_DEFAULTS });
      }
    } catch {
      setConfig({ ...STORAGE_CONFIG_DEFAULTS });
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (field, value) => setConfig((prev) => ({ ...prev, [field]: value }));
  const setNumber = (field, value) => set(field, value === '' ? 0 : Number(value) || 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...config };
      delete payload.id;
      delete payload.created_date;
      delete payload.updated_date;
      delete payload.created_by_id;
      const me = await base44.auth.me().catch(() => null);
      payload.updated_by = me?.email || '';
      if (configId) {
        await base44.entities.StorageChargeConfig.update(configId, payload);
      } else {
        const created = await base44.entities.StorageChargeConfig.create(payload);
        setConfigId(created?.id || null);
      }
      toast.success('Tarifas de almacenamiento guardadas');
    } catch {
      toast.error('No se pudieron guardar las tarifas');
    }
    setSaving(false);
  };

  if (loading || !config) {
    return (
      <Card className="mt-6 rounded-2xl border-0 shadow-lg">
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6 rounded-2xl border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Warehouse className="h-5 w-5" />
          Almacenamiento y custodia
        </CardTitle>
        <CardDescription>
          Cargos automáticos desde el día 8 de emisión de la factura. Se calculan cada día para las facturas impagas y se suman a su saldo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 p-4 md:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Días 1 al 7</p>
            <p className="text-lg font-bold text-slate-800">USD $0</p>
            <p className="text-[11px] text-slate-500">Almacenamiento gratuito</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Desde el día 8</p>
            <p className="text-lg font-bold text-slate-800">${config.standard_daily_rate} / ${config.large_daily_rate} diarios</p>
            <p className="text-[11px] text-slate-500">Bulto estándar / bulto grande</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Montacargas</p>
            <p className="text-lg font-bold text-slate-800">${config.forklift_fee} por palet</p>
            <p className="text-[11px] text-slate-500">Cargo único, se suma al diario</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Bulto estándar (USD diarios)</Label>
            <Input type="number" step="0.01" value={config.standard_daily_rate} onChange={(e) => setNumber('standard_daily_rate', e.target.value)} />
            <p className="text-xs text-slate-500">Bultos de hasta {config.standard_max_cbm} CBM de volumen.</p>
          </div>
          <div className="space-y-2">
            <Label>Bulto grande (USD diarios)</Label>
            <Input type="number" step="0.01" value={config.large_daily_rate} onChange={(e) => setNumber('large_daily_rate', e.target.value)} />
            <p className="text-xs text-slate-500">Bultos que superan ese volumen en CBM.</p>
          </div>
          <div className="space-y-2">
            <Label>Montacargas (USD por palet, cargo único)</Label>
            <Input type="number" step="0.01" value={config.forklift_fee} onChange={(e) => setNumber('forklift_fee', e.target.value)} />
            <p className="text-xs text-slate-500">Se cobra una sola vez por cada palet marcado que requiera el equipo.</p>
          </div>
          <div className="space-y-2">
            <Label>Volumen máximo del bulto estándar (CBM)</Label>
            <Input type="number" step="0.001" min="0" value={config.standard_max_cbm} onChange={(e) => setNumber('standard_max_cbm', e.target.value)} />
            <p className="text-xs text-slate-500">Si el volumen del bulto lo supera, se cobra como grande. Referencia: 30 × 30 × 30 cm = 0.027 CBM.</p>
          </div>
          <div className="space-y-2">
            <Label>Días de almacenamiento gratuito</Label>
            <Input type="number" value={config.free_days} onChange={(e) => setNumber('free_days', e.target.value)} />
            <p className="text-xs text-slate-500">Desde la emisión de la factura. El cargo empieza el día siguiente.</p>
          </div>
          <div className="space-y-2">
            <Label>Último día en que se acumulan cargos</Label>
            <Input type="number" value={config.max_days} onChange={(e) => setNumber('max_days', e.target.value)} />
            <p className="text-xs text-slate-500">Después de ese día el sistema deja de cobrar y queda pendiente revisar el procedimiento contractual.</p>
          </div>
          <div className="space-y-2">
            <Label>Categoría cuando no hay medidas</Label>
            <Select value={config.default_category} onValueChange={(value) => set('default_category', value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="estandar">Estándar (USD {config.standard_daily_rate} diarios)</SelectItem>
                <SelectItem value="grande">Grande (USD {config.large_daily_rate} diarios)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">Se usa solo si el bulto no tiene medidas registradas ni marca manual.</p>
          </div>
          <div className="space-y-3 rounded-xl border border-slate-200 p-3">
            <label className="flex items-start gap-3 text-sm">
              <Switch checked={config.large_if_multiple_packages !== false} onCheckedChange={(v) => set('large_if_multiple_packages', v)} />
              <span>Cajas consolidadas y bultos con varios paquetes cuentan como grandes</span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <Switch checked={config.fallback_unit_per_order !== false} onCheckedChange={(v) => set('fallback_unit_per_order', v)} />
              <span>Si la factura no tiene bultos registrados, cobrar un bulto estándar por cada envío facturado</span>
            </label>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="flex items-start gap-3 text-sm">
            <Switch checked={config.is_active !== false} onCheckedChange={(v) => set('is_active', v)} />
            <span className="font-medium">Cálculo automático activo</span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <Switch checked={config.notify_client !== false} onCheckedChange={(v) => set('notify_client', v)} />
            <span>Avisar al cliente (notificación en la app y email) cada vez que se agrega un cargo</span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <Switch checked={config.skip_threshold_days !== false} onCheckedChange={(v) => set('skip_threshold_days', v)} />
            <span>No enviar el aviso diario los días 20, 30 y 45 (esos días ya tienen su propio aviso de almacenamiento)</span>
          </label>
        </div>

        <p className="text-xs text-slate-500">
          Cada bulto puede marcarse a mano como estándar o grande, y sus palets con montacargas, desde
          Gestión de Facturas, botón “Cargos de almacenamiento”. El desglose día por día queda registrado para auditoría.
        </p>

        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Guardar tarifas de almacenamiento
        </Button>
      </CardContent>
    </Card>
  );
}