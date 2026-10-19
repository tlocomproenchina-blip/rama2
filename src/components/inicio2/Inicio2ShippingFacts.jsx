import React from 'react';
import { Package, Truck } from 'lucide-react';

const facts = [
  {
    icon: Package,
    title: 'Sin mínimo ni máximo de envío',
    desc: 'Puedes enviar desde un lápiz hasta varios contenedores completos. No exigimos peso, volumen ni cantidad mínima de bultos.',
  },
  {
    icon: Truck,
    title: 'Puerta a puerta incluido en la tarifa',
    desc: 'Todos los envíos se entregan puerta a puerta en tu dirección en Venezuela, sin importar el volumen, y la entrega va incluida en la tarifa por CBM de tu estado. No hay retiro en oficinas de encomiendas.',
  },
];

export default function Inicio2ShippingFacts() {
  return (
    <section className="bg-white py-12 md:py-16">
      <div className="mx-auto grid max-w-6xl gap-5 px-4 sm:grid-cols-2">
        {facts.map((f) => (
          <div key={f.title} className="flex gap-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
              <f.icon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-slate-900">{f.title}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}