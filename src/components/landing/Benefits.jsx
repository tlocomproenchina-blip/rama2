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
    <section className="mt-10 rounded-2xl border bg-gradient-to-br from-[#0B1F3A] to-[#173B6A] p-6 md:p-8 text-white">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-white">Beneficios</h2>
        <p className="text-slate-600 mt-1">Eficiencia, seguridad y transparencia en cada envío.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((b, i) => (
          <Card key={i} className="bg-white/5 backdrop-blur-sm border-[#E5C770]/30 hover:border-[#E5C770]/50 hover:shadow-[0_0_0_1px_rgba(229,199,112,0.4)] transition-all">
            <CardHeader className="flex flex-row items-center gap-3">
              <b.icon className="h-6 w-6 text-[#E5C770]" />
              <CardTitle className="text-lg">{b.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-white/85">{b.desc}</CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}