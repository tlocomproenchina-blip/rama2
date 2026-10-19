import React, { useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, TrendingUp } from 'lucide-react';
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
              <p className="text-xs text-slate-500 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Precio final Regular (por CBM)</p>
              {cargoType === 'general' && (
                <span className="shrink-0 rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">Aplicada</span>
              )}
            </div>
            <p className="font-semibold text-blue-700">${num(stateInfo?.final_regular).toFixed(2)} / CBM</p>
            <p className="text-[11px] text-slate-500 mt-1">Con 400 kg o más: ${(num(stateInfo?.final_regular) * 2).toFixed(2)} / CBM (x2)</p>
          </div>
          <div className={`rounded-lg bg-blue-50 border p-3 ${cargoType === 'alto_riesgo' ? 'border-amber-400 ring-1 ring-amber-200' : 'border-blue-100'}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-slate-500 flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Precio final Alto riesgo (por CBM)</p>
              {cargoType === 'alto_riesgo' && (
                <span className="shrink-0 rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Aplicada</span>
              )}
            </div>
            <p className="font-semibold text-blue-700">${num(stateInfo?.final_high).toFixed(2)} / CBM</p>
            <p className="text-[11px] text-slate-500 mt-1">Con 400 kg o más: ${(num(stateInfo?.final_high) * 2).toFixed(2)} / CBM (x2)</p>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}