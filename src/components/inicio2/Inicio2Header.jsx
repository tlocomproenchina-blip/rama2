import React from 'react';
import { base44 } from '@/api/base44Client';
import { Ship, Headphones } from 'lucide-react';

export default function Inicio2Header() {
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500 text-white">
            <Ship className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="font-display text-base font-extrabold text-white">TLEC<span className="text-orange-500">Cargo</span></p>
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-orange-400">Couriers &amp; Logistics</p>
          </div>
        </div>
        <nav className="hidden items-center gap-6 text-sm font-medium text-zinc-300 md:flex">
          <button onClick={() => scrollTo('calculadora2')} className="hover:text-white">Calculadora</button>
          <button onClick={() => scrollTo('servicios2')} className="hover:text-white">Servicios</button>
          <button onClick={() => scrollTo('preguntas2')} className="hover:text-white">Preguntas</button>
        </nav>
        <div className="flex items-center gap-2">
          <a href="https://wa.me/" className="hidden items-center gap-1.5 text-sm text-zinc-300 hover:text-white lg:flex">
            <Headphones className="h-4 w-4" /> Soporte
          </a>
          <button
            onClick={() => scrollTo('calculadora2')}
            className="hidden rounded-lg border border-orange-500/60 px-4 py-2 text-sm font-semibold text-orange-400 hover:bg-orange-500/10 sm:block"
          >
            Cotizar
          </button>
          <button
            onClick={() => base44.auth.redirectToLogin('/Dashboard')}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600"
          >
            Crear Casillero Gratis
          </button>
        </div>
      </div>
    </header>
  );
}