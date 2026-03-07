import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';

export default function HomeHeader({ onLogin }) {
  return (
    <header className="sticky top-0 z-30 w-full bg-white/80 backdrop-blur-2xl border-b border-slate-200/50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link to={createPageUrl('Home')} className="flex items-center gap-2">
          <span className="text-2xl font-black bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">TLEC</span>
          <span className="text-2xl font-black text-slate-900">CARGO</span>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600">
          <a href="#features" className="relative hover:text-slate-900 transition-colors after:absolute after:left-0 after:-bottom-1 after:h-0.5 after:w-0 after:bg-blue-600 after:transition-all hover:after:w-full">Beneficios</a>
          <a href="#process" className="relative hover:text-slate-900 transition-colors after:absolute after:left-0 after:-bottom-1 after:h-0.5 after:w-0 after:bg-blue-600 after:transition-all hover:after:w-full">Proceso</a>
          <a href="#services" className="relative hover:text-slate-900 transition-colors after:absolute after:left-0 after:-bottom-1 after:h-0.5 after:w-0 after:bg-blue-600 after:transition-all hover:after:w-full">Servicios</a>
          <a href="#pricing" className="relative hover:text-slate-900 transition-colors after:absolute after:left-0 after:-bottom-1 after:h-0.5 after:w-0 after:bg-blue-600 after:transition-all hover:after:w-full">Tarifas</a>
          <a href="#faq" className="relative hover:text-slate-900 transition-colors after:absolute after:left-0 after:-bottom-1 after:h-0.5 after:w-0 after:bg-blue-600 after:transition-all hover:after:w-full">FAQ</a>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onLogin} className="hidden sm:inline-flex">Iniciar sesión</Button>
          <Link to={createPageUrl('ShippingCalculator')}>
            <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-600">Cotizar</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}