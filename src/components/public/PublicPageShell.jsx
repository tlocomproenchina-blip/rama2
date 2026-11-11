import React from 'react';
import Inicio2Header from '@/components/inicio2/Inicio2Header';
import Inicio2Footer from '@/components/inicio2/Inicio2Footer';

// Marco común de las páginas públicas: cabecera con el logo, franja grafito
// con el título en la paleta de la marca y pie de página.
export default function PublicPageShell({ eyebrow, title, description, width = 'max-w-5xl', children }) {
  return (
    <div className="-m-4 flex min-h-screen flex-col bg-background md:-m-6 lg:-m-8">
      <Inicio2Header />
      <section className="relative overflow-hidden bg-zinc-950 text-white">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/25 blur-3xl" />
        <div className={`relative mx-auto w-full ${width} px-4 py-12 sm:py-16`}>
          {eyebrow && (
            <p className="inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight sm:text-5xl">{title}</h1>
          {description && <p className="mt-3 max-w-2xl text-base text-zinc-300 sm:text-lg">{description}</p>}
        </div>
      </section>
      <main className={`mx-auto w-full flex-1 ${width} px-4 py-10 sm:py-14`}>{children}</main>
      <Inicio2Footer />
    </div>
  );
}