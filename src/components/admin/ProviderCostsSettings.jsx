import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Loader2, Plus, Trash2, Wallet } from 'lucide-react';

export default function ProviderCostsSettings({ config, setConfig, onSave, saving }) {
  const ranges = Array.isArray(config.provider_special_cbm_rates) ? config.provider_special_cbm_rates : [];

  const setField = (field, value) => {
    setConfig({ ...config, [field]: parseFloat(value) || 0 });
  };

  const updateRange = (index, field, value) => {
    const updated = ranges.map((r, i) => i === index ? { ...r, [field]: parseFloat(value) || 0 } : r);
    setConfig({ ...config, provider_special_cbm_rates: updated });
  };

  const addRange = () => {
    setConfig({ ...config, provider_special_cbm_rates: [...ranges, { min_cbm: 0, max_cbm: 0, rate_regular: 0, rate_high_risk: 0 }] });
  };

  const removeRange = (index) => {
    setConfig({ ...config, provider_special_cbm_rates: ranges.filter((_, i) => i !== index) });
  };

  return (
    <Card className="rounded-2xl border-0 shadow-lg mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-amber-600" />
          Costos del Proveedor (Cuentas por Pagar)
        </CardTitle>
        <CardDescription>
          Lo que TE CUESTA cada servicio con tu proveedor. Se usa para generar automáticamente las cuentas por pagar y calcular la ganancia de cada factura.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 p-4 md:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Costo marítimo Regular ($/CBM)</Label>
            <Input type="number" step="0.01" value={config.provider_rate_sea_general ?? 0}
              onChange={(e) => setField('provider_rate_sea_general', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Costo marítimo Alto Riesgo ($/CBM)</Label>
            <Input type="number" step="0.01" value={config.provider_rate_sea_sensitive ?? 0}
              onChange={(e) => setField('provider_rate_sea_sensitive', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Costo aéreo General ($/kg)</Label>
            <Input type="number" step="0.01" value={config.provider_rate_air_general ?? 0}
              onChange={(e) => setField('provider_rate_air_general', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Costo aéreo Sensible ($/kg)</Label>
            <Input type="number" step="0.01" value={config.provider_rate_air_sensitive ?? 0}
              onChange={(e) => setField('provider_rate_air_sensitive', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Costo seguro del proveedor (% del FOB)</Label>
            <Input type="number" step="0.01" value={config.provider_insurance_percentage ?? 0}
              onChange={(e) => setField('provider_insurance_percentage', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Costo recepción por paquete ($)</Label>
            <Input type="number" step="0.01" value={config.provider_reception_fee ?? 0}
              onChange={(e) => setField('provider_reception_fee', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Costo puerta a puerta ($)</Label>
            <Input type="number" step="0.01" value={config.provider_door_to_door_cost ?? 0}
              onChange={(e) => setField('provider_door_to_door_cost', e.target.value)} />
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-slate-800">Costos por rango de CBM (cargas &lt; 0.130 CBM)</h4>
            <p className="text-sm text-slate-500">Costo del proveedor por rango, para cargas pequeñas.</p>
          </div>

          {/* Mobile */}
          <div className="space-y-3 md:hidden">
            {ranges.map((row, index) => (
              <div key={index} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">CBM mínimo</p>
                    <Input type="number" step="0.0001" value={row.min_cbm} onChange={(e) => updateRange(index, 'min_cbm', e.target.value)} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">CBM máximo</p>
                    <Input type="number" step="0.0001" value={row.max_cbm} onChange={(e) => updateRange(index, 'max_cbm', e.target.value)} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Costo Regular ($)</p>
                    <Input type="number" step="0.01" value={row.rate_regular} onChange={(e) => updateRange(index, 'rate_regular', e.target.value)} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Costo Alto Riesgo ($)</p>
                    <Input type="number" step="0.01" value={row.rate_high_risk} onChange={(e) => updateRange(index, 'rate_high_risk', e.target.value)} />
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full text-red-600 border-red-200 hover:bg-red-50" onClick={() => removeRange(index)}>
                  <Trash2 className="h-4 w-4 mr-1" /> Eliminar rango
                </Button>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden md:block border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3 font-medium text-slate-700">CBM mínimo</th>
                  <th className="text-left p-3 font-medium text-slate-700">CBM máximo</th>
                  <th className="text-left p-3 font-medium text-slate-700">Costo Regular ($)</th>
                  <th className="text-left p-3 font-medium text-slate-700">Costo Alto Riesgo ($)</th>
                  <th className="text-center p-3 font-medium text-slate-700"></th>
                </tr>
              </thead>
              <tbody>
                {ranges.map((row, index) => (
                  <tr key={index} className="border-t hover:bg-slate-50">
                    <td className="p-3">
                      <Input type="number" step="0.0001" value={row.min_cbm} onChange={(e) => updateRange(index, 'min_cbm', e.target.value)} className="w-32" />
                    </td>
                    <td className="p-3">
                      <Input type="number" step="0.0001" value={row.max_cbm} onChange={(e) => updateRange(index, 'max_cbm', e.target.value)} className="w-32" />
                    </td>
                    <td className="p-3">
                      <Input type="number" step="0.01" value={row.rate_regular} onChange={(e) => updateRange(index, 'rate_regular', e.target.value)} className="w-32" />
                    </td>
                    <td className="p-3">
                      <Input type="number" step="0.01" value={row.rate_high_risk} onChange={(e) => updateRange(index, 'rate_high_risk', e.target.value)} className="w-32" />
                    </td>
                    <td className="p-3 text-center">
                      <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => removeRange(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button variant="outline" onClick={addRange} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" /> Agregar rango
          </Button>
        </div>

        <Button onClick={onSave} disabled={saving} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Guardar costos del proveedor
        </Button>

        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
          <p className="text-xs text-amber-800">
            Al facturar en Facturación Manual, el sistema usará estos costos para crear automáticamente la cuenta por pagar al proveedor y calcular la ganancia (precio cliente − costo proveedor).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}