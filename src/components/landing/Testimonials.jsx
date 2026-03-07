import React from "react";

const data = [
  { q: "Excelente manejo de consolidaciones, ahorré en CBM y llegó antes de lo previsto.", a: "Carlos R." },
  { q: "Atención clara y soporte por WhatsApp en todo momento.", a: "Mariana P." },
];

export default function Testimonials() {
  return (
    <section className="mt-12 rounded-2xl border bg-gradient-to-br from-[#0B1F3A] to-[#173B6A] p-6 md:p-8 text-white">
      <h2 className="text-2xl font-bold mb-4 text-white">Testimonios</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {data.map((t, i) => (
          <div key={i} className="rounded-2xl border border-[#E5C770]/30 bg-white/5 backdrop-blur-sm p-6 shadow-sm">
            <p className="text-white">“{t.q}”</p>
            <p className="mt-3 text-sm text-white/70">— {t.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}