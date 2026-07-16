import React from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowRight, Ship, Anchor, Globe2 } from 'lucide-react';

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
          <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-400">
                <Globe2 className="h-4 w-4" /> Ruta Marítima Directa
              </p>
              <span className="rounded-md bg-white/10 px-2 py-1 text-[10px] font-bold text-zinc-200">75-90 DÍAS</span>
            </div>
            <div className="relative mt-4 flex h-56 items-center justify-center overflow-hidden rounded-xl border border-white/5 bg-zinc-950">
              <div
                className="absolute inset-0 opacity-20"
                style={{ backgroundImage: 'radial-gradient(circle, #f97316 1.5px, transparent 1.5px)', backgroundSize: '18px 18px' }}
              />
              <div className="relative flex w-full items-center justify-between px-8">
                <div className="text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/20 text-orange-400">
                    <Anchor className="h-5 w-5" />
                  </div>
                  <p className="mt-2 text-xs font-bold text-white">Yiwu, China</p>
                  <p className="text-[10px] text-zinc-500">Puerto de origen</p>
                </div>
                <div className="relative mx-3 flex-1">
                  <div className="border-t-2 border-dashed border-orange-500/60" />
                  <Ship className="absolute -top-3 left-1/2 h-5 w-5 -translate-x-1/2 text-orange-400" />
                </div>
                <div className="text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                    <Anchor className="h-5 w-5" />
                  </div>
                  <p className="mt-2 text-xs font-bold text-white">Venezuela</p>
                  <p className="text-[10px] text-zinc-500">Puerto destino</p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-3">
                <Ship className="h-5 w-5 text-zinc-300" />
                <div>
                  <p className="text-xs font-bold text-white">Buque Portacontenedores</p>
                  <p className="text-[10px] text-zinc-500">Tránsito Internacional Directo</p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Navegando
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}