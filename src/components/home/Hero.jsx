import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Zap, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Hero({ onLogin }) {
  return (
    <section className="relative overflow-hidden">
      {/* background blurs */}
      <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-blue-100 blur-3xl opacity-60" />
      <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-blue-100 blur-3xl opacity-50" />

      <div className="max-w-7xl mx-auto px-6 py-16 md:py-20 grid md:grid-cols-2 gap-10 items-center">
        {/* Left */}
        <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .8 }}>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/70 px-3 py-1 text-xs font-medium text-blue-700 shadow-sm">
            <Zap className="h-4 w-4" /> Envíos optimizados China → Venezuela
          </div>
          <h1 className="mt-4 text-5xl md:text-7xl font-black leading-tight">
            <span className="bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">Logística sin fricción</span>
          </h1>
          <p className="mt-4 text-slate-600 text-lg max-w-xl">Consolidamos, aseguramos y entregamos puerta a puerta con transparencia total y soporte 24/7.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to={createPageUrl('ShippingCalculator')}>
              <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-600">Calcular tarifas <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </Link>
            <Link to={createPageUrl('Register')}>
              <Button variant="outline">Registrarse</Button>
            </Link>
          </div>
          {/* Stats */}
          <div className="mt-8 grid grid-cols-3 gap-4 max-w-md">
            {[
              { k: '500+', v: 'Clientes' },
              { k: '98%', v: 'Satisfacción' },
              { k: '24/7', v: 'Soporte' },
            ].map((s, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white/70 p-4 text-center">
                <div className="text-2xl font-black text-slate-900">{s.k}</div>
                <div className="text-xs text-slate-500">{s.v}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right illustration */}
        <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .8 }} className="relative">
          <div className="relative rounded-3xl border-2 border-slate-100 bg-white/80 backdrop-blur-2xl p-3 md:p-4 shadow-xl">
            <video
              className="w-full h-60 md:h-72 lg:h-96 rounded-2xl object-cover"
              src="https://videos.pexels.com/video-files/10529628/10529628-hd_2560_1440_24fps.mp4"
              poster="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/695da428c9924ef9b68e8866/5f2251a69_B761FC7B-A523-4A5C-9E96-DB83AFEFEAC8.png"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
            />
            <p className="mt-3 text-center text-slate-600">Consolidación inteligente, envío seguro y entrega a tiempo.</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}