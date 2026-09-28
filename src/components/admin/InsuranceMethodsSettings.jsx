import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ShieldCheck } from 'lucide-react';

const ALL_METHODS = [
  { key: 'paypal', label: 'PayPal' },
  { key: 'binance', label: 'Binance Pay' },
  { key: 'usdt_trc20', label: 'USDT TRC20' },
  { key: 'transferencia', label: 'Transferencia' },
  { key: 'wally', label: 'Wally' },
  { key: 'zinli', label: 'Zinli' },
  { key: 'wise', label: 'Wise' },
  { key: 'skrill', label: 'Skrill' },
  { key: 'pago_movil_usdt', label: 'Pago Móvil USDT' },
  { key: 'zelle', label: 'Zelle' },
  { key: 'otro', label: 'Otro' },
];

export default function InsuranceMethodsSettings({ config, setConfig }) {
  const selected = useMemo(
    () => (Array.isArray(config?.insurance_enabled_methods) ? config.insurance_enabled_methods : []),
    [config?.insurance_enabled_methods]
  );

  const toggleMethod = (key) => {
    const current = Array.isArray(config?.insurance_enabled_methods) ? config.insurance_enabled_methods : [];
    const next = current.includes(key) ? current.filter((m) => m !== key) : [...current, key];
    setConfig((prev) => ({ ...prev, insurance_enabled_methods: next }));
  };

  return (
    <Card className="rounded-2xl border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          Métodos de pago para el seguro
        </CardTitle>
        <CardDescription>
          Selecciona qué métodos se aceptan específicamente para el pago del seguro de carga. Si no marcas ninguno, el cliente verá todos los métodos globales habilitados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs text-slate-600 mb-2 block">Métodos aceptados para el seguro</Label>
          <div className="grid gap-2 sm:grid-cols-3">
            {ALL_METHODS.map((m) => (
              <label
                key={m.key}
                className={`flex items-center gap-2 rounded-lg border p-2 text-xs cursor-pointer transition-all ${
                  selected.includes(m.key)
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700 font-medium'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(m.key)}
                  onChange={() => toggleMethod(m.key)}
                  className="accent-emerald-600"
                />
                {m.label}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {selected.length === 0
              ? 'Sin selección: se usarán todos los métodos globales habilitados.'
              : `${selected.length} método(s) seleccionado(s) para el seguro.`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}