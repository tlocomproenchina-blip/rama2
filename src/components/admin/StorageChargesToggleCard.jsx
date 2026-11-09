import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Switch } from '@/components/ui/switch';
import { Warehouse, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Interruptor general de los cargos diarios de almacenamiento y custodia.
// Se guarda al instante en la configuración de almacenamiento (config_key 'main').
export default function StorageChargesToggleCard({ user }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.entities.StorageChargeConfig.filter({ config_key: 'main' }, '-updated_date', 1)
      .then((rows) => setConfig(rows?.[0] || null))
      .finally(() => setLoading(false));
  }, []);

  const enabled = config?.charges_enabled === true;
  const freeDays = Number(config?.free_days ?? 7);

  const toggle = async (checked) => {
    setSaving(true);
    const data = {
      charges_enabled: checked,
      is_active: checked,
      charges_enabled_updated_at: new Date().toISOString(),
      updated_by: user?.email || '',
    };
    try {
      const saved = config?.id
        ? await base44.entities.StorageChargeConfig.update(config.id, data)
        : await base44.entities.StorageChargeConfig.create({ config_key: 'main', ...data });
      setConfig({ ...(config || {}), ...saved, ...data });
      toast.success(checked ? 'Cargos de almacenamiento activados' : 'Cargos de almacenamiento en pausa');
    } catch (error) {
      toast.error('No se pudo guardar el interruptor');
    }
    setSaving(false);
  };

  return (
    <div className="p-4 md:p-6 bg-orange-50 rounded-xl border border-orange-200 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Warehouse className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-lg">Cargos de almacenamiento y custodia</h3>
            <p className="text-sm text-slate-600">
              Al activarlo, el proceso diario agrega cargos a las facturas impagas desde el día {freeDays + 1}
              {' '}(los primeros {freeDays} días son gratuitos). El cambio se guarda al instante.
            </p>
          </div>
        </div>
        {loading || saving ? (
          <Loader2 className="h-5 w-5 animate-spin text-orange-600 shrink-0" />
        ) : (
          <Switch checked={enabled} onCheckedChange={toggle} />
        )}
      </div>
      {!loading && (
        <p className={`text-xs font-medium ${enabled ? 'text-emerald-700' : 'text-slate-500'}`}>
          {enabled ? 'Activo: se cobran los días nuevos en cada ejecución diaria.' : 'En pausa: no se agregan cargos nuevos a ninguna factura.'}
        </p>
      )}
    </div>
  );
}