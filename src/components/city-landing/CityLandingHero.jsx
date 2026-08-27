import React from 'react';
import { Ship, Anchor, Clock } from 'lucide-react';

export default function CityLandingHero({ city }) {
  return (
    <section className="relative overflow-hidden bg-zinc-950 text-white">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-blue-500 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-orange-500 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-orange-400">
          <Ship className="h-3.5 w-3.5" /> Envíos Marítimos · China → Venezuela
        </div>
        <h1 className="mt-5 font-display text-3xl font-extrabold leading-tight sm:text-5xl">
          Envíos Marítimos desde China a {city.city} <span className="text-orange-500">| TLEC Cargo</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base text-zinc-300 sm:text-lg">
          Consolidamos tu carga en Yiwu, China y la entregamos puerta a puerta en {city.city}, {city.state_name}.
          Servicio LCL (consolidado) y FCL (contenedor completo) con seguimiento en tiempo real y seguro opcional.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-zinc-200">
            <Clock className="h-4 w-4 text-orange-400" /> Tránsito LCL: {city.transit_lcl}
          </span>
          <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-zinc-200">
            <Anchor className="h-4 w-4 text-blue-400" /> Tránsito FCL: {city.transit_fcl}
          </span>
        </div>
      </div>
    </section>
  );
}