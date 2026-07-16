import React from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowRight } from 'lucide-react';
import InteractiveGlobe from '@/components/inicio2/InteractiveGlobe';

const stats = [
  { value: '+5 Años', label: 'EXPERIENCIA' },
  { value: '+25k', label: 'ENVÍOS SEGUROS' },
  { value: '100%', label: 'GARANTIZADO' },
];

export default function Inicio2Hero() {
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  return (
    <section className="relative overflow-hidden bg-zinc-950 text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '48px 48px' }}
      />
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-orange-500/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 md:py-24 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-zinc-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Casillero en Yiwu, China 100% Gratis
          </span>
          <h1 className="mt-6 font-display text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
            Llevamos tus compras de <span className="text-orange-500">China a Venezuela</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-zinc-400">
            Compra en Alibaba, 1688, Pinduoduo, Taobao, Weidian o cualquier tienda online y recíbelo en la puerta de tu casa en Venezuela. Consolidación de mercancía 100% gratuita.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => base44.auth.redirectToLogin('/Dashboard')}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/30 hover:bg-orange-600"
            >
              Abrir Casillero Gratis <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => scrollTo('calculadora2')}
              className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold text-white hover:bg-white/10"
            >
              Calcular Tarifa
            </button>
          </div>
          <div className="mt-10 grid grid-cols-3 gap-4 max-w-md">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="font-display text-xl font-extrabold text-orange-500 sm:text-2xl">{s.value}</p>
                <p className="mt-1 text-[10px] font-semibold tracking-[0.14em] text-zinc-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <span className="absolute -top-4 right-4 z-10 rotate-3 rounded-md bg-orange-500 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-lg">
            ¡Casillero 100% Gratis!
          </span>
          <InteractiveGlobe />
        </div>
      </div>
    </section>
  );
}