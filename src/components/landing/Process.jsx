import React from "react";
import { MapPin, Package, Clock } from "lucide-react";

export default function Process() {
  return (
    <section className="mt-12 rounded-2xl border bg-gradient-to-br from-slate-50 to-slate-100 p-6 md:p-8">
      <h2 className="text-2xl font-bold mb-4 text-slate-900">Cómo funciona</h2>
      <div className="grid gap-6 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2 font-medium text-slate-800"><MapPin className="h-5 w-5 text-blue-700" /> Dirección en China</div>
          <p className="text-slate-600 mt-1">Recibe tus compras en nuestro almacén y reporta con pre‑alerta.</p>
        </div>
        <div>
          <div className="flex items-center gap-2 font-medium text-slate-800"><Package className="h-5 w-5 text-blue-700" /> Consolidación</div>
          <p className="text-slate-600 mt-1">Unimos paquetes, optimizamos volumen (CBM) y embalamos.</p>
        </div>
        <div>
          <div className="flex items-center gap-2 font-medium text-slate-800"><Clock className="h-5 w-5 text-blue-700" /> Envío y entrega</div>
          <p className="text-slate-600 mt-1">Marítimo o aéreo según tu prioridad de tiempo y costo.</p>
        </div>
      </div>
    </section>
  );
}