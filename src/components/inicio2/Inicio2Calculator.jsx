import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Ship, ChevronRight, Info, Loader2 } from 'lucide-react';

const MIN_CBM = 0.13;
const RECEPTION_FEE = 1;
const DENSITY_LIMIT_KG = 499;

export default function Inicio2Calculator() {
  const [config, setConfig] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [states, setStates] = useState([]);
  const [selectedState, setSelectedState] = useState('');
  const [category, setCategory] = useState('general');
  const [dims, setDims] = useState({ largo: 50, ancho: 50, alto: 50 });
  const [peso, setPeso] = useState(5);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);

  useEffect(() => {
    (async () => {
      const [cfgs, prc, sts] = await Promise.all([
        base44.entities.AppConfig.filter({ config_key: 'main' }),
        base44.entities.PricingConfig.filter({ config_key: 'main' }),
        base44.entities.StateConfig.filter({ is_active: true }),
      ]);
      setConfig(cfgs[0] || null);
      setPricing(prc[0] || null);
      const sorted = sts.sort((a, b) => (a.state_name || '').localeCompare(b.state_name || ''));
      setStates(sorted);
      const def = sorted.find((s) => s.state_code === 'carabobo') || sorted[0];
      if (def) setSelectedState(def.state_code);
      setLoading(false);
    })();
  }, []);

  const stateCfg = states.find((s) => s.state_code === selectedState);

  const handleCalc = () => {
    if (!stateCfg) return;
    const cbm = (Number(dims.largo) * Number(dims.ancho) * Number(dims.alto)) / 1000000;
    if (!(cbm > 0)) return;

    const isSensitive = category === 'sensible';
    const profit = (pricing?.profit_percentage || 0) / 100;
    const door = pricing?.door_to_door_cost || 0;
    const base = isSensitive ? (pricing?.base_rate_high_risk || 0) : (pricing?.base_rate_regular || 0);
    let rate = base * (1 + profit) + (stateCfg.shipping_rate || 0) + door;

    const multiplier = Number(peso) > DENSITY_LIMIT_KG ? 2 : 1;
    let freight = cbm * rate * multiplier;
    let specialRate = false;

    if (cbm < MIN_CBM) {
      const ranges = [...(config?.special_cbm_rates || [])].sort((a, b) => (a.min_cbm || 0) - (b.min_cbm || 0));
      const found = ranges.find((r) => cbm <= (r.max_cbm || 0));
      if (found) {
        specialRate = true;
        rate = isSensitive ? found.rate_high_risk : found.rate_regular;
        freight = rate;
      }
    }

    setResult({ cbm, rate, total: freight + RECEPTION_FEE, specialRate, multiplier });
  };

  const setDim = (key) => (e) => setDims((d) => ({ ...d, [key]: e.target.value }));
  const inputCls = 'mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm font-semibold text-slate-900 focus:border-orange-400 focus:outline-none';

  return (
    <section id="calculadora2" className="bg-slate-50 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500">Herramientas Express</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold text-slate-900 sm:text-4xl">Calcula tu envío al instante</h2>
          <p className="mt-3 text-slate-500">Cotiza fletes marítimos desde China según tu estado de destino.</p>
        </div>

        {loading ? (
          <div className="mt-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>
        ) : (
        <div className="mt-10 grid gap-6 rounded-3xl bg-white p-4 shadow-xl sm:p-8 lg:grid-cols-2">
          <div className="space-y-4">
            <h3 className="font-display text-lg font-bold text-slate-900">Parámetros del Paquete</h3>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Origen del envío</p>
              <div className="mt-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-center text-sm font-semibold text-white">
                🇨🇳 China (Yiwu) — 🚢 Marítimo
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Estado de destino</p>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-900 focus:border-orange-400 focus:outline-none"
              >
                {states.map((s) => (
                  <option key={s.state_code} value={s.state_code}>{s.state_name}</option>
                ))}
              </select>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Categoría de carga</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[['general', 'General'], ['sensible', 'Sensible']].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setCategory(val)}
                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${category === val ? 'bg-sky-600 text-white' : 'border border-slate-200 bg-slate-50 text-slate-600'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Dimensiones en centímetros (cm)</p>
              <div className="mt-2 grid grid-cols-3 gap-3">
                {[['largo', 'Largo'], ['ancho', 'Ancho'], ['alto', 'Alto']].map(([key, label]) => (
                  <div key={key}>
                    <label className="text-xs text-slate-500">{label}</label>
                    <input type="number" min="0" value={dims[key]} onChange={setDim(key)} className={inputCls} />
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Peso real del paquete (kg)</p>
              <div className="mt-1 flex gap-2">
                <input type="number" min="0" value={peso} onChange={(e) => setPeso(e.target.value)} className={inputCls} />
                <span className="mt-1 flex shrink-0 items-center rounded-lg border border-slate-200 bg-slate-100 px-3 text-xs text-slate-500">Kilogramos (kg)</span>
              </div>
            </div>
            <button
              onClick={handleCalc}
              className="flex w-full items-center justify-center gap-1 rounded-xl bg-zinc-900 px-6 py-3.5 text-sm font-bold text-white hover:bg-zinc-800"
            >
              Calcular Costo Estimado <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col rounded-2xl border border-slate-100 bg-slate-50/60 p-5 sm:p-6">
            <h3 className="border-b border-slate-200 pb-3 font-display text-lg font-bold text-slate-900">Resumen del Flete</h3>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Volumen:</span><span className="font-bold text-slate-900">{result ? result.cbm.toFixed(4) : '—'} CBM (m³)</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Ruta de Envío:</span><span className="font-bold text-slate-900">🇨🇳 Yiwu → 🇻🇪 {stateCfg?.state_name || 'Venezuela'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Tarifa Unitaria:</span><span className="font-bold text-slate-900">{result ? `$${result.rate.toFixed(2)}${result.specialRate ? ' fija' : ' / CBM'}` : '—'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Tiempo de Tránsito:</span><span className="font-bold text-sky-700">🚢 75 a 90 días</span></div>
            </div>
            {result?.specialRate && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                Carga menor a 0.130 CBM: aplica tarifa fija por rango. Llega a nuestro almacén en Valencia y el despacho final es vía MRW cobro destino (no incluido).
              </div>
            )}
            {result?.multiplier === 2 && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                Sobrepeso: el peso real supera los 499 kg, se aplica x2 al costo del envío.
              </div>
            )}
            <div className="mt-6 flex-1 rounded-2xl bg-white p-6 text-center shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Total Estimado</p>
              <p className="mt-2 font-display text-4xl font-extrabold text-slate-900 sm:text-5xl">
                {result ? `$${result.total.toFixed(2)}` : '$0.00'} <span className="text-sm font-semibold text-slate-400">USD</span>
              </p>
              {result && <p className="mt-2 text-[11px] text-slate-400">Incluye $1.00 de recepción de paquete. No incluye seguro.</p>}
            </div>
            <button
              onClick={() => base44.auth.redirectToLogin('/Dashboard')}
              className="mt-6 w-full rounded-xl bg-orange-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600"
            >
              Reservar esta Tarifa
            </button>
          </div>
        </div>
        )}
      </div>
    </section>
  );
}