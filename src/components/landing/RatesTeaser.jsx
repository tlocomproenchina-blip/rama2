import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function RatesTeaser({ states, selectedCode, setSelectedCode }) {
  const s = useMemo(() => states.find((x) => x.state_code === selectedCode), [states, selectedCode]);
  const reg = s?.final_rate_regular;
  const high = s?.final_rate_high;

  return (
    <section className="mt-12 rounded-2xl border bg-gradient-to-br from-[#0B1F3A] to-[#173B6A] p-6 md:p-8 text-white">
      <h2 className="text-2xl font-bold mb-2 text-white">Tarifas transparentes</h2>
      <p className="text-white/85">Calcula tu envío en minutos y compara marítimo vs aéreo según tiempos y presupuesto.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-[320px_auto] items-start">
        <div>
          <Select value={selectedCode} onValueChange={setSelectedCode}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecciona tu estado" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {states.map((st) => (
                <SelectItem key={st.id} value={st.state_code}>{st.state_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to={createPageUrl('ShippingCalculator')}><Button className="bg-blue-600 hover:bg-blue-700">Calcular ahora</Button></Link>
          <Link to={createPageUrl('Rates')}><Button variant="outline" className="bg-white/10 text-white border-white/30 hover:bg-white/20">Ver tarifas y condiciones</Button></Link>
        </div>
      </div>

      {selectedCode && (
        <div className="mt-4 rounded-xl bg-gradient-to-r from-[#0B1F3A] to-[#173B6A] text-white p-5 border border-white/10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="uppercase text-xs/5 tracking-wider text-white/70">Tarifa final por unidad</div>
              <div className="text-2xl font-bold">{s?.state_name || selectedCode}</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-3xl font-extrabold">
                {reg && reg > 0 ? `$${Number(reg).toLocaleString('en-US')}` : 'Consultar'}
                <span className="text-sm font-medium ml-2 text-white/80">regular</span>
              </div>
              {high && high > 0 && (
                <div className="text-sm bg-white/15 px-3 py-1 rounded-full">
                  Alto riesgo: <b>${Number(high).toLocaleString('en-US')}</b>
                </div>
              )}
            </div>
          </div>
          <div className="mt-2 text-white/90 text-sm">Tiempo estimado marítimo: 90 días</div>
        </div>
      )}
    </section>
  );
}