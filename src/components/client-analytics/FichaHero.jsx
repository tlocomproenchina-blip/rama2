import React from 'react';

export default function FichaHero({ children }) {
  return (
    <div className="relative z-30 rounded-2xl border border-border bg-card px-5 pt-8 pb-14 shadow-card md:px-14 md:pt-10 md:pb-16">
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent" />
      </div>
      <div className="relative flex flex-col gap-3 animate-[ficha-rise_.7s_cubic-bezier(.2,.7,.2,1)_both]">
        <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-link">TLEC CARGO · Clientes</span>
        <h1 className="m-0 max-w-[760px] font-display text-3xl md:text-5xl leading-tight font-extrabold text-foreground">
          Analítica de clientes
        </h1>
        <p className="m-0 max-w-[640px] text-base text-muted-foreground">
          Busca un cliente y visualiza su gasto, costos de envío y desempeño de consolidaciones.
        </p>
        <div className="mt-2 w-full max-w-[620px] rounded-xl bg-card focus-within:ring-2 focus-within:ring-primary">
          {children}
        </div>
      </div>
    </div>
  );
}