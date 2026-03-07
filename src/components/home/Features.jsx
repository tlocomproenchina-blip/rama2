import React from 'react';
import { Ship, Package, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

const items = [
  { icon: Ship, title: 'Marítimo y Aéreo', desc: 'Rutas optimizadas desde China, salidas regulares.' },
  { icon: Package, title: 'Consolidación inteligente', desc: 'Ahorra con CBM optimizado y embalaje seguro.' },
  { icon: ShieldCheck, title: 'Seguro y tracking', desc: 'Cobertura y trazabilidad en cada hito.' },
];

export default function Features() {
  return (
    <section id="features" className="py-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid gap-6 md:grid-cols-3">
          {items.map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              className="group relative rounded-2xl bg-white border-2 border-slate-100 p-6 hover:border-blue-200 transition-all">
              <div className="absolute inset-x-0 -top-0.5 h-0.5 rounded-t-2xl bg-gradient-to-r from-blue-500 to-blue-700 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-md flex items-center justify-center">
                <f.icon className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">{f.title}</h3>
              <p className="mt-1 text-slate-600">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}