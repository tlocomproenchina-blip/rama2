import React from "react";
import { Button } from "@/components/ui/button";
import { Plane, Ship, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function ModeCompare() {
  return (
    <section className="mt-12 rounded-2xl border bg-white p-6 md:p-8">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h2 className="text-2xl font-bold">Elige tu modo de envío</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {/* Aéreo */}
        <div className="rounded-xl border p-5">
          <div className="flex items-center gap-2 mb-2">
            <Plane className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold">Aéreo</h3>
          </div>
          <p className="text-slate-600">Ideal para cargas urgentes y sensibles.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-slate-500">Tiempo estimado</div>
              <div className="font-semibold">7–12 días</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-slate-500">Costo orientativo</div>
              <div className="font-semibold">$ por kg</div>
            </div>
          </div>
          <div className="mt-4">
            <Link to={createPageUrl('ShippingCalculator?mode=aereo')}>
              <Button className="bg-blue-600 hover:bg-blue-700">Cotizar aéreo <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </Link>
          </div>
        </div>

        {/* Marítimo */}
        <div className="rounded-xl border p-5">
          <div className="flex items-center gap-2 mb-2">
            <Ship className="h-5 w-5 text-indigo-600" />
            <h3 className="font-semibold">Marítimo</h3>
          </div>
          <p className="text-slate-600">Optimiza costos por CBM con salidas regulares.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-slate-500">Tiempo estimado</div>
              <div className="font-semibold">60–90 días</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-slate-500">Costo orientativo</div>
              <div className="font-semibold">$ por CBM</div>
            </div>
          </div>
          <div className="mt-4">
            <Link to={createPageUrl('ShippingCalculator?mode=maritimo')}>
              <Button className="bg-indigo-600 hover:bg-indigo-700">Cotizar marítimo <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}