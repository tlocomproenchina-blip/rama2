import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';

export default function Pricing({ states, selectedCode, setSelectedCode }) {
  const s = states.find((x) => x.state_code === selectedCode);
  const reg = s?.final_rate_regular;
  const high = s?.final_rate_high;

  return (
    <section id="pricing" className="py-14 bg-gradient-to-br from-white to-blue-50">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-[360px_auto] gap-8 items-start">
        <div>
          <h2 className="text-3xl font-black text-slate-900 mb-2">Tarifas transparentes</h2>
          <p className="text-slate-600 mb-4">Calcula tu envío y compara marítimo vs aéreo según tiempo y presupuesto.</p>
          <Select value={selectedCode} onValueChange={setSelectedCode}>
            <SelectTrigger className="w-full focus:ring-2 focus:ring-blue-600">
              <SelectValue placeholder="Selecciona tu estado" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {states.map((st) => (
                <SelectItem key={st.id} value={st.state_code}>{st.state_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to={createPageUrl('ShippingCalculator')}><Button className="bg-gradient-to-r from-blue-600 to-blue-700">Calcular ahora</Button></Link>
            <Link to={createPageUrl('Rates')}><Button variant="outline">Ver condiciones</Button></Link>
          </div>
        </div>

        <div className="grid gap-4">
          {selectedCode ? (
            <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 shadow-lg">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="uppercase text-xs tracking-wider opacity-90">Tarifa final por unidad</div>
                  <div className="text-2xl font-bold">{s?.state_name || selectedCode}</div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-3xl font-extrabold">
                    {reg && reg > 0 ? `$${Number(reg).toLocaleString('en-US')}` : 'Consultar'}
                    <span className="text-sm font-medium ml-2 opacity-90">regular</span>
                  </div>
                  <div className="h-8 w-px bg-white/30 hidden sm:block" />
                  <div className="text-3xl font-extrabold">
                    {high && high > 0 ? `$${Number(high).toLocaleString('en-US')}` : 'Consultar'}
                    <span className="text-sm font-medium ml-2 opacity-90">alto riesgo</span>
                  </div>
                </div>
              </div>
              <div className="mt-2 text-white/90 text-sm">Tiempo estimado marítimo: 90 días</div>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-6 text-slate-500">Selecciona un estado para ver tarifas estimadas.</div>
          )}

          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { k: 'CBM óptimo', v: 'Consolidación' },
              { k: 'Seguro', v: 'Opcional' },
              { k: 'Soporte', v: '24/7' },
            ].map((x, i) => (
              <div key={i} className="rounded-xl bg-white border-2 border-slate-100 p-4 text-center">
                <div className="text-base font-semibold text-slate-900">{x.k}</div>
                <div className="text-xs text-slate-500">{x.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}