import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Ship, Package, ShieldCheck } from "lucide-react";

const items = [
  { icon: Ship, title: "Marítimo y Aéreo", desc: "Rutas optimizadas desde puertos y aeropuertos clave en China." },
  { icon: Package, title: "Consolidación inteligente", desc: "Ahorra con consolidación y embalaje seguro." },
  { icon: ShieldCheck, title: "Seguro y trazabilidad", desc: "Cobertura y tracking en cada hito." },
];

export default function Benefits() {
  return (
    <section className="mt-10">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-slate-900">Beneficios</h2>
        <p className="text-slate-600 mt-1">Eficiencia, seguridad y transparencia en cada envío.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((b, i) => (
          <Card key={i} className="bg-white/90 backdrop-blur border-slate-200 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center gap-3">
              <b.icon className="h-6 w-6 text-blue-700" />
              <CardTitle className="text-lg">{b.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-600">{b.desc}</CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}