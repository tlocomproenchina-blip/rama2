import React from "react";
import { Badge } from "@/components/ui/badge";

export default function StateRateList({ states = [], pricingConfig, appConfig }) {
  const logo = appConfig?.invoice_logo_url || appConfig?.app_logo_url;
  const profit = pricingConfig?.profit_percentage ?? 0;
  const d2d = pricingConfig?.door_to_door_cost ?? 0;

  const calcRegular = (s) => {
    if (s?.final_rate_regular && s.final_rate_regular > 0) return s.final_rate_regular;
    const base = pricingConfig?.base_rate_regular ?? 0;
    const shippingRate = s?.shipping_rate ?? 0;
    return +(base * (1 + (profit/100)) + shippingRate + d2d).toFixed(2);
  };

  const calcHigh = (s) => {
    if (s?.final_rate_high && s.final_rate_high > 0) return s.final_rate_high;
    const base = pricingConfig?.base_rate_high_risk ?? 0;
    const shippingRate = s?.shipping_rate ?? 0;
    return +(base * (1 + (profit/100)) + shippingRate + d2d).toFixed(2);
  };

  return (
    <div className="space-y-4">
      {/* Header con logo y porcentaje */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {logo && (
            <img src={logo} alt="Logo" className="h-10 w-10 rounded-md object-cover bg-white border" />
          )}
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Lista de precios por estado</h3>
            <p className="text-xs text-slate-500">Incluye costo puerta a puerta y margen</p>
          </div>
        </div>
        <Badge className="bg-emerald-100 text-emerald-700">Margen: {profit}%</Badge>
      </div>

      {/* Nota de $1 por consolidación */}
      <div className="p-3 rounded-lg bg-blue-50 text-blue-800 text-xs border border-blue-100">
        Condición informativa: se suma $1 por consolidación.
      </div>

      {/* Tabla de estados */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-600">
              <th className="py-2 pr-3">Estado</th>
              <th className="py-2 px-3">Regular (USD)</th>
              <th className="py-2 px-3">Alto riesgo (USD)</th>
            </tr>
          </thead>
          <tbody>
            {states.map((s) => (
              <tr key={s.id} className="border-t border-slate-200">
                <td className="py-2 pr-3 text-slate-800">{s.state_name}</td>
                <td className="py-2 px-3 font-medium text-slate-900">${calcRegular(s).toFixed(2)}</td>
                <td className="py-2 px-3 font-medium text-slate-900">${calcHigh(s).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}