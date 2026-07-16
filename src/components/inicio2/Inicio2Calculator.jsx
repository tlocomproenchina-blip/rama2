import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Ship, ChevronRight, Info } from 'lucide-react';

const RATE_PER_CBM = 320;
const MIN_FREIGHT = 150;

export default function Inicio2Calculator() {
  const [dims, setDims] = useState({ largo: 12, ancho: 12, alto: 12 });
  const [peso, setPeso] = useState(5);
  const [result, setResult] = useState(null);

  const handleCalc = () => {
    const cbm = (Number(dims.largo) * Number(dims.ancho) * Number(dims.alto) * 16.387064) / 1000000;
    const raw = cbm * RATE_PER_CBM;
    const total = Math.max(raw, MIN_FREIGHT);
    setResult({ cbm, total, minApplied: raw < MIN_FREIGHT });
  };

  const setDim = (key) => (e) => setDims((d) => ({ ...d, [key]: e.target.value }));

  return (
    <section id="calculadora2" className="bg-slate-50 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500">Herramientas Express</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold text-slate-900 sm:text-4xl">Calcula tu envío al instante</h2>
          <p className="mt-3 text-slate-500">Cotiza fletes marítimos desde China con un solo clic.</p>
        </div>

        <div className="mt-10 grid gap-6 rounded-3xl bg-white p-4 shadow-xl sm:p-8 lg:grid-cols-2">
          <div className="space-y-4">
            <h3 className="font-display text-lg font-bold text-slate-900">Parámetros del Paquete</h3>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Origen del envío</p>
              <div className="mt-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-center text-sm font-semibold text-white">
                🇨🇳 China (Yiwu)
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Modalidad de envío</p>
              <div className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white">
                <Ship className="h-4 w-4" /> Envío Marítimo
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Dimensiones en pulgadas (in)</p>
              <div className="mt-2 grid grid-cols-3 gap-3">
                {[['largo', 'Largo'], ['ancho', 'Ancho'], ['alto', 'Alto']].map(([key, label]) => (
                  <div key={key}>
                    <label className="text-xs text-slate-500">{label}</label>
                    <input
                      type="number" min="0" value={dims[key]} onChange={setDim(key)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm font-semibold text-slate-900 focus:border-orange-400 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Peso real del paquete (kg)</p>
              <div className="mt-2 flex gap-2">
                <input
                  type="number" min="0" value={peso} onChange={(e) => setPeso(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm font-semibold text-slate-900 focus:border-orange-400 focus:outline-none"
                />
                <span className="flex shrink-0 items-center rounded-lg border border-slate-200 bg-slate-100 px-3 text-xs text-slate-500">Kilogramos (kg)</span>
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
              <div className="flex justify-between"><span className="text-slate-500">Volumen:</span><span className="font-bold text-slate-900">{result ? result.cbm.toFixed(3) : '—'} CBM (m³)</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Ruta de Envío:</span><span className="font-bold text-slate-900">🇨🇳 China → 🇻🇪 Venezuela</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Tarifa Unitaria:</span><span className="font-bold text-slate-900">${RATE_PER_CBM.toFixed(2)} / CBM</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Modalidad:</span><span className="font-bold text-sky-700">🚢 Marítimo</span></div>
            </div>
            {result?.minApplied && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                Tarifa mínima comercial aplicada (${MIN_FREIGHT.toFixed(2)} USD) para envíos desde China.
              </div>
            )}
            <div className="mt-6 flex-1 rounded-2xl bg-white p-6 text-center shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Total Estimado</p>
              <p className="mt-2 font-display text-4xl font-extrabold text-slate-900 sm:text-5xl">
                {result ? `$${result.total.toFixed(2)}` : '$0.00'} <span className="text-sm font-semibold text-slate-400">USD</span>
              </p>
            </div>
            <button
              onClick={() => base44.auth.redirectToLogin('/Dashboard')}
              className="mt-6 w-full rounded-xl bg-orange-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600"
            >
              Reservar esta Tarifa
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}