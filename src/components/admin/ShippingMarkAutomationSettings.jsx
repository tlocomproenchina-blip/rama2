import React, { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tag, Loader2, Hash } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function ShippingMarkAutomationSettings({ appConfig, setAppConfig }) {
  const enabled = !!appConfig.shipping_mark_auto_assign_enabled;
  const [counter, setCounter] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newStart, setNewStart] = useState('');

  const loadCounter = async () => {
    setLoading(true);
    try {
      const rows = await base44.entities.ShippingMarkCounter.filter({ config_key: 'main' }, '-updated_date', 1);
      const c = rows?.[0] || null;
      setCounter(c);
      setNewStart(c ? String(Number(c.last_number) + 1) : '50000');
    } catch (e) {
      console.error('Error cargando contador de Shipping Mark:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (enabled && !counter && !loading) loadCounter();
  }, [enabled]);  

  const handleApplyStart = async () => {
    const parsed = parseInt(newStart, 10);
    if (!parsed || parsed < 1) {
      toast.error('Ingresa un número de inicio válido (mayor a 0).');
      return;
    }
    setSaving(true);
    try {
      const targetLast = parsed - 1;
      if (counter?.id) {
        await base44.entities.ShippingMarkCounter.update(counter.id, { last_number: targetLast });
      } else {
        const created = await base44.entities.ShippingMarkCounter.create({ config_key: 'main', last_number: targetLast });
        setCounter(created);
      }
      setCounter((prev) => ({ ...(prev || { config_key: 'main' }), last_number: targetLast }));
      toast.success(`La serie continuará desde ${parsed}.`);
    } catch (e) {
      toast.error('No se pudo actualizar la serie: ' + (e?.message || 'error desconocido'));
    } finally {
      setSaving(false);
    }
  };

  const nextNumber = counter ? Number(counter.last_number) + 1 : 50000;

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
          checked={enabled}
          onCheckedChange={(checked) => setAppConfig({ ...appConfig, shipping_mark_auto_assign_enabled: checked })}
        />
      </div>

      {enabled && (
        <div className="mt-5 rounded-xl border border-sky-200/70 bg-white/70 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Hash className="h-4 w-4 text-sky-600" />
            <h4 className="text-sm font-semibold text-slate-800">Serie numérica del Shipping Mark</h4>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            El formato se mantiene como <span className="font-mono font-semibold text-slate-700">N#-TLEC-NNNNN</span>.
            Aquí defines desde qué número continuará la secuencia (ej: saltar a 90000).
          </p>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando serie actual...
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">Próximo número</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    className="w-40"
                    placeholder={String(nextNumber)}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleApplyStart}
                  disabled={saving}
                  className="gap-2"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Aplicar serie
                </Button>
                <div className="text-xs text-slate-500">
                  Actual: <span className="font-mono font-semibold text-slate-700">{nextNumber.toLocaleString()}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Al aplicar, el próximo cliente registrado recibirá el número que indiques. Los clientes ya asignados conservan su Shipping Mark actual.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}