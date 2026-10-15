import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, Loader2, Plus, Trash2, Ruler } from 'lucide-react';

export default function SpecialCbmRatesEditor({ rates, onChange, onSave, saving }) {
  const list = Array.isArray(rates) ? rates : [];

  const updateRow = (index, field, value) => {
    const updated = list.map((r, i) => i === index ? { ...r, [field]: parseFloat(value) || 0 } : r);
    onChange(updated);
  };

  const addRow = () => {
    onChange([...list, { min_cbm: 0, max_cbm: 0, rate_regular: 0, rate_high_risk: 0 }]);
  };

  const removeRow = (index) => {
    onChange(list.filter((_, i) => i !== index));
  };

  return (
    <Card className="rounded-2xl border-0 shadow-lg mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ruler className="h-5 w-5" />
          Tarifas Especiales por CBM (cargas menores a 0.130 CBM)
        </CardTitle>
        <CardDescription>
          Tarifa fija por rango de CBM para cargas pequeñas. La entrega final es puerta a puerta en la dirección del cliente (9 USD por bulto).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4 md:p-6">
        {/* Mobile */}
        <div className="space-y-4 md:hidden">
          {list.map((row, index) => (
            <div key={index} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500 mb-1">CBM mínimo</p>
                  <Input type="number" step="0.0001" value={row.min_cbm} onChange={(e) => updateRow(index, 'min_cbm', e.target.value)} />
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">CBM máximo</p>
                  <Input type="number" step="0.0001" value={row.max_cbm} onChange={(e) => updateRow(index, 'max_cbm', e.target.value)} />
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Tarifa Regular ($)</p>
                  <Input type="number" step="0.01" value={row.rate_regular} onChange={(e) => updateRow(index, 'rate_regular', e.target.value)} />
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Tarifa Alto Riesgo ($)</p>
                  <Input type="number" step="0.01" value={row.rate_high_risk} onChange={(e) => updateRow(index, 'rate_high_risk', e.target.value)} />
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full text-red-600 border-red-200 hover:bg-red-50" onClick={() => removeRow(index)}>
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
                <th className="text-left p-3 font-medium text-slate-700">Tarifa Regular ($)</th>
                <th className="text-left p-3 font-medium text-slate-700">Tarifa Alto Riesgo ($)</th>
                <th className="text-center p-3 font-medium text-slate-700"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((row, index) => (
                <tr key={index} className="border-t hover:bg-slate-50">
                  <td className="p-3">
                    <Input type="number" step="0.0001" value={row.min_cbm} onChange={(e) => updateRow(index, 'min_cbm', e.target.value)} className="w-32" />
                  </td>
                  <td className="p-3">
                    <Input type="number" step="0.0001" value={row.max_cbm} onChange={(e) => updateRow(index, 'max_cbm', e.target.value)} className="w-32" />
                  </td>
                  <td className="p-3">
                    <Input type="number" step="0.01" value={row.rate_regular} onChange={(e) => updateRow(index, 'rate_regular', e.target.value)} className="w-32" />
                  </td>
                  <td className="p-3">
                    <Input type="number" step="0.01" value={row.rate_high_risk} onChange={(e) => updateRow(index, 'rate_high_risk', e.target.value)} className="w-32" />
                  </td>
                  <td className="p-3 text-center">
                    <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => removeRow(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" onClick={addRow} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" /> Agregar rango
          </Button>
          <Button onClick={onSave} disabled={saving} className="w-full sm:flex-1">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar tarifas especiales
          </Button>
        </div>

        <div className="p-3 bg-sky-50 rounded-lg border border-sky-200">
          <p className="text-xs text-sky-800">
            Estas tarifas aplican a envíos marítimos con CBM menor a 0.130. Se cobra la tarifa fija del rango correspondiente + $1 por recepción de paquete. Cargas de 0.130 CBM o más usan la tarifa por CBM con servicio puerta a puerta.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}