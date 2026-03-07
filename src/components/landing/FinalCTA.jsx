import React from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function FinalCTA() {
  return (
    <section className="mt-12 text-center rounded-2xl border border-[#E5C770]/30 bg-gradient-to-br from-[#0B1F3A] to-[#173B6A] p-8">
      <h3 className="text-xl md:text-2xl font-semibold text-white">¿Listo para enviar desde China a Venezuela?</h3>
      <p className="text-white/90 mt-2">Obtén una cotización hoy y recibe asesoría experta.</p>
      <div className="mt-4 flex justify-center gap-3">
        <Link to={createPageUrl('ShippingCalculator')}><Button className="bg-blue-600 hover:bg-blue-700">Solicitar cotización</Button></Link>
        <Link to={createPageUrl('Support')}><Button variant="outline" className="bg-white/10 text-white border-white/30 hover:bg-white/20">Hablar con soporte</Button></Link>
      </div>
    </section>
  );
}