import React from "react";

const data = [
  { q: "Excelente manejo de consolidaciones, ahorré en CBM y llegó antes de lo previsto.", a: "Carlos R." },
  { q: "Atención clara y soporte por WhatsApp en todo momento.", a: "Mariana P." },
];

export default function Testimonials() {
  return (
    <section className="mt-12">
      <h2 className="text-2xl font-bold mb-4 text-slate-900">Testimonios</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {data.map((t, i) => (
          <div key={i} className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-slate-800">“{t.q}”</p>
            <p className="mt-3 text-sm text-slate-500">— {t.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}