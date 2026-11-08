import React from 'react';

export default function FichaHero({ children }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-secondary px-5 pt-10 pb-14 md:px-14 md:pt-12 md:pb-16">
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative flex flex-col gap-4 animate-[ficha-rise_.7s_cubic-bezier(.2,.7,.2,1)_both]">
        <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">TLEC CARGO · Clientes</span>
        <h1 className="m-0 max-w-[760px] font-display text-3xl md:text-5xl leading-tight font-extrabold text-secondary-foreground">
          Analítica de clientes
        </h1>
        <p className="m-0 max-w-[640px] text-base text-secondary-foreground/70">
          Busca un cliente y visualiza su gasto, costos de envío y desempeño de consolidaciones.
        </p>
        <div className="mt-2 w-full max-w-[620px] rounded-xl bg-card shadow-premium focus-within:ring-2 focus-within:ring-primary">
          {children}
        </div>
      </div>
    </div>
  );
}