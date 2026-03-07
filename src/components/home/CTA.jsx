import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';

export default function CTA() {
  return (
    <section className="relative py-16">
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-blue-600 via-blue-700 to-slate-800" />
      <div className="absolute -top-20 left-1/4 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-16 right-1/4 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
      <div className="max-w-7xl mx-auto px-6 text-center text-white">
        <h3 className="text-4xl md:text-6xl font-black">¿Listo para comenzar?</h3>
        <p className="mt-2 text-white/80">Cotiza hoy y recibe asesoría experta de nuestro equipo.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to={createPageUrl('ShippingCalculator')}><Button variant="secondary" className="bg-white text-slate-900 hover:bg-white/90">Solicitar cotización</Button></Link>
          <Link to={createPageUrl('Support')}><Button variant="outline" className="text-white border-white hover:bg-white/10">Hablar con soporte</Button></Link>
        </div>
      </div>
    </section>
  );
}