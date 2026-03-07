import React from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function FAQTeaser() {
  return (
    <section className="mt-12 rounded-2xl border bg-white p-6 md:p-8">
      <h2 className="text-2xl font-bold mb-4 text-slate-900">Preguntas frecuentes</h2>
      <div className="space-y-4">
        <div>
          <div className="font-medium text-slate-800">¿Cuánto tarda el envío marítimo vs aéreo?</div>
          <p className="text-slate-600">Marítimo suele tardar más pero reduce costo/CBM; aéreo es más rápido para cargas urgentes.</p>
        </div>
        <div>
          <div className="font-medium text-slate-800">¿Puedo consolidar paquetes de diferentes proveedores?</div>
          <p className="text-slate-600">Sí, consolidamos en nuestro almacén de China para optimizar volumen y seguridad.</p>
        </div>
        <div>
          <div className="font-medium text-slate-800">¿Qué documentación necesito?</div>
          <p className="text-slate-600">Factura/comercial y datos del destinatario; te asesoramos en requisitos aduaneros.</p>
        </div>
      </div>
      <div className="mt-4">
        <Link to={createPageUrl('FAQ')}><Button variant="ghost">Ver más preguntas</Button></Link>
      </div>
    </section>
  );
}