import React from 'react';
import { Ship, Plane, ShieldCheck } from 'lucide-react';

const services = [
  { icon: Ship, title: 'Marítimo (FCL/LCL)', desc: 'Optimización por CBM y salidas regulares.' },
  { icon: Plane, title: 'Aéreo', desc: 'Para cargas urgentes y sensibles.' },
  { icon: ShieldCheck, title: 'Seguro', desc: 'Cobertura para tu mercancía.' },
];

export default function Services() {
  return (
    <section id="services" className="py-12">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-3xl font-black text-slate-900 mb-6">Servicios</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {services.map((s, i) => (
            <div key={i} className="group rounded-2xl bg-white border-2 border-slate-100 p-6 transition-all hover:border-blue-200">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 text-white flex items-center justify-center shadow-md">
                <s.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-3 text-lg font-bold text-slate-900">{s.title}</h3>
              <p className="text-slate-600 mt-1">{s.desc}</p>
              <button className="mt-3 text-blue-600 inline-flex items-center gap-1 text-sm">Saber más</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}