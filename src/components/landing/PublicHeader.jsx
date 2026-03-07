import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";

export default function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 bg-[#0B1F3A] text-white/90 border-b border-white/10" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
        {/* Brand */}
        <Link to={createPageUrl('Home')} className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-white/10 border border-white/15 flex items-center justify-center text-sm font-bold">TL</div>
          <span className="font-semibold tracking-tight text-white">TLEC CARGO</span>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link to={createPageUrl('ShippingCalculator')} className="hover:text-white">Calculadora</Link>
          <Link to={createPageUrl('Rates')} className="hover:text-white">Tarifas</Link>
          <Link to={createPageUrl('ShipmentTracking')} className="hover:text-white">Tracking</Link>
          <Link to={createPageUrl('Support')} className="hover:text-white">Soporte</Link>
        </nav>

        {/* CTAs */}
        <div className="flex items-center gap-2">
          <Link to={createPageUrl('ShippingCalculator')}>
            <Button size="sm" className="bg-[#1E5BB8] hover:bg-[#1A4DA0]">Cotizar</Button>
          </Link>
          <Button size="sm" variant="outline" className="border-white/30 text-white hover:bg-white/10" onClick={() => window.location.assign(createPageUrl('Home'))}>
            Iniciar sesión
          </Button>
        </div>
      </div>
    </header>
  );
}