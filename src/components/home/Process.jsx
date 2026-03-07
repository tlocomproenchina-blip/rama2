import React from 'react';
import { MapPin, Package, Ship, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

const steps = [
  { icon: MapPin, title: 'Dirección en China', desc: 'Recibimos tus compras en almacén.' },
  { icon: Package, title: 'Consolidación', desc: 'Unimos paquetes y optimizamos CBM.' },
  { icon: Ship, title: 'Envío', desc: 'Marítimo o aéreo según prioridad.' },
  { icon: CheckCircle2, title: 'Entrega', desc: 'Puerta a puerta, sin fricción.' },
];

export default function Process() {
  return (
    <section id="process" className="py-14">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-3xl font-black text-slate-900 mb-6">Cómo funciona</h2>
        <div className="grid gap-6 md:grid-cols-4">
          {steps.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              className="relative rounded-2xl bg-white border-2 border-slate-100 p-6">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 text-white flex items-center justify-center font-bold shadow-md">{i + 1}</div>
              <div className="absolute top-6 right-0 left-0 mx-6 h-px bg-slate-100 hidden md:block" aria-hidden />
              <div className="mt-4 flex items-center gap-2 text-slate-900 font-semibold"><s.icon className="h-5 w-5 text-blue-600" /> {s.title}</div>
              <p className="text-slate-600 mt-1">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}