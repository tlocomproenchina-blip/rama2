import React, { useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, TrendingUp, Layers } from 'lucide-react';
import { CANONICAL_STATE_NAMES } from '@/components/utils/states';
import CargoTypeSelector from '@/components/manual-billing/CargoTypeSelector';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export default function ClientStateRatesCard({ client, stateConfigs, appConfig, pricing, cargoType = 'general', onCargoTypeChange }) {
  const stateInfo = useMemo(() => {
    const code = String(client?.state || '').trim().toLowerCase();
    if (!code) return null;
    const match = (stateConfigs || []).find((s) => String(s.state_code).toLowerCase() === code);
    const shippingRate = num(match?.shipping_rate);
    const profitFactor = 1 + num(pricing?.profit_percentage) / 100;
    const doorToDoor = num(pricing?.door_to_door_cost);
    const finalRegular = num(pricing?.base_rate_regular) * profitFactor + shippingRate + doorToDoor;
    const finalHigh = num(pricing?.base_rate_high_risk) * profitFactor + shippingRate + doorToDoor;
    return {
      state_code: code,
      state_name: match?.state_name || CANONICAL_STATE_NAMES[code] || code,
      shipping_rate: shippingRate,
      final_regular: finalRegular,
      final_high: finalHigh,
      found: !!match,
    };
  }, [client, stateConfigs, pricing]);

  const specialRates = useMemo(() => {
    const list = Array.isArray(appConfig?.special_cbm_rates) ? appConfig.special_cbm_rates : [];
    return [...list].sort((a, b) => num(a.min_cbm) - num(b.min_cbm));
  }, [appConfig]);

  if (!client?.state) return null;

  return (
    <Card className="border-0 shadow-lg">
      <CardContent className="p-5 space-y-4 overflow-hidden">
        <div className="flex items-center gap-2 text-slate-800">
          <MapPin className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold">Estado registrado del cliente</h3>
        </div>

        <CargoTypeSelector value={cargoType} onChange={onCargoTypeChange} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
            <p className="text-xs text-slate-500">Estado</p>
            <p className="font-semibold text-slate-800">{stateInfo?.state_name}</p>
            {!stateInfo?.found && (
              <p className="text-[11px] text-amber-600 mt-1">Sin tarifa configurada en StateConfig</p>
            )}
          </div>
          <div className={`rounded-lg bg-blue-50 border p-3 ${cargoType === 'general' ? 'border-blue-400 ring-1 ring-blue-200' : 'border-blue-100'}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-slate-500 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Precio final Regular (≥ 0.130)</p>
              {cargoType === 'general' && (
                <span className="shrink-0 rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">Aplicada</span>
              )}
            </div>
            <p className="font-semibold text-blue-700">${num(stateInfo?.final_regular).toFixed(2)} / CBM</p>
            <p className="text-[11px] text-slate-500 mt-1">0.130 CBM: ${(num(stateInfo?.final_regular) * 0.130).toFixed(2)}</p>
          </div>
          <div className={`rounded-lg bg-blue-50 border p-3 ${cargoType === 'alto_riesgo' ? 'border-amber-400 ring-1 ring-amber-200' : 'border-blue-100'}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-slate-500 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Precio final Alto riesgo (≥ 0.130)</p>
              {cargoType === 'alto_riesgo' && (
                <span className="shrink-0 rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Aplicada</span>
              )}
            </div>
            <p className="font-semibold text-blue-700">${num(stateInfo?.final_high).toFixed(2)} / CBM</p>
            <p className="text-[11px] text-slate-500 mt-1">0.130 CBM: ${(num(stateInfo?.final_high) * 0.130).toFixed(2)}</p>
          </div>
        </div>

        {specialRates.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">
              <Layers className="h-4 w-4 text-slate-500" /> Tarifas mínimas (cargas &lt; 0.130 CBM)
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-max text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left p-2 font-medium">Rango CBM</th>
                    <th className="text-left p-2 font-medium">Regular ($)</th>
                    <th className="text-left p-2 font-medium">Alto riesgo ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {specialRates.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="p-2 text-slate-700">{num(r.min_cbm).toFixed(4)} – {num(r.max_cbm).toFixed(4)}</td>
                      <td className="p-2 font-semibold text-slate-800">${num(r.rate_regular).toFixed(2)}</td>
                      <td className="p-2 font-semibold text-slate-800">${num(r.rate_high_risk).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}