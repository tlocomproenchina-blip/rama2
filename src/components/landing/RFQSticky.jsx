import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { base44 } from "@/components/api/ApiQueueManager";

export default function RFQSticky() {
  const [states, setStates] = React.useState([]);
  const [mode, setMode] = React.useState("aereo");
  const [unit, setUnit] = React.useState("kg");
  const [value, setValue] = React.useState(5);
  const [stateCode, setStateCode] = React.useState("");

  React.useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.StateConfig.filter({ is_active: true });
        setStates(list);
      } catch (_) {}
    })();
  }, []);

  const query = () => {
    const params = new URLSearchParams();
    if (mode) params.set("mode", mode);
    if (unit) params.set("unit", unit);
    if (value) params.set("value", String(value));
    if (stateCode) params.set("state", stateCode);
    return `ShippingCalculator?${params.toString()}`;
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto max-w-7xl px-3 pb-[calc(env(safe-area-inset-bottom)+10px)]">
        <div className="rounded-t-2xl border border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-lg p-3 md:p-4">
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            {/* Modo */}
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm">
              <option value="aereo">Aéreo</option>
              <option value="maritimo">Marítimo</option>
            </select>

            {/* Unidad */}
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm">
              <option value="kg">KG</option>
              <option value="cbm">CBM</option>
            </select>

            {/* Valor */}
            <input
              type="number"
              min={0}
              step={unit === 'kg' ? 1 : 0.01}
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              placeholder={unit === 'kg' ? 'Peso (kg)' : 'Volumen (CBM)'}
              className="h-10 w-28 rounded-md border border-slate-300 bg-white px-3 text-sm"
            />

            {/* Estado */}
            <select value={stateCode} onChange={(e) => setStateCode(e.target.value)} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm min-w-40">
              <option value="">Destino (Estado)</option>
              {states.map((s) => (
                <option key={s.id} value={s.state_code}>{s.state_name}</option>
              ))}
            </select>

            <div className="ml-auto">
              <Link to={createPageUrl(query())}>
                <Button className="bg-[#1E5BB8] hover:bg-[#1A4DA0]">Cotizar ahora</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}