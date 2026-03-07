import React from 'react';
import { Star } from 'lucide-react';

const testimonials = [
  { q: 'Excelente manejo de consolidaciones, ahorré en CBM y llegó antes de lo previsto.', a: 'Carlos R.' },
  { q: 'Atención clara y soporte por WhatsApp en todo momento.', a: 'Mariana P.' },
  { q: 'Tarifas transparentes y proceso sencillo. Muy recomendados.', a: 'Luis F.' },
];

export default function Testimonials() {
  return (
    <section className="py-12">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-3xl font-black text-slate-900 mb-6">Clientes felices</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <div key={i} className="rounded-2xl bg-white border-2 border-slate-100 p-6 shadow-sm">
              <div className="flex items-center gap-1 text-yellow-400">
                {Array.from({ length: 5 }).map((_, j) => <Star key={j} className="h-4 w-4 fill-yellow-400" />)}
              </div>
              <p className="mt-3 italic text-slate-700">“{t.q}”</p>
              <p className="mt-3 text-sm text-slate-500 font-semibold">— {t.a}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            { k: '500+', v: 'Clientes' },
            { k: '98%', v: 'Satisfacción' },
            { k: '4.9/5', v: 'Calificación' },
            { k: '24/7', v: 'Soporte' },
          ].map((s, i) => (
            <div key={i} className="rounded-xl border bg-white p-4">
              <div className="text-2xl font-black text-slate-900">{s.k}</div>
              <div className="text-xs text-slate-500">{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}