import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Ship, Plane, ShieldCheck, Package } from "lucide-react";

const items = [
  { icon: Ship, title: "Marítimo (FCL/LCL)", desc: "Optimización por CBM y salidas regulares." },
  { icon: Plane, title: "Aéreo", desc: "Para cargas urgentes y sensibles." },
  { icon: ShieldCheck, title: "Seguro", desc: "Cobertura para tu mercancía." },
  { icon: Package, title: "Puerta a puerta", desc: "Entrega final en tu destino." },
];

export default function Services() {
  return (
    <section className="mt-12 rounded-2xl border bg-gradient-to-br from-[#0B1F3A] to-[#173B6A] p-6 md:p-8 text-white">
      <h2 className="text-2xl font-bold mb-4 text-white">Servicios</h2>
      <div className="grid gap-4 md:grid-cols-4">
        {items.map((s, i) => (
          <Card key={i} className="bg-white/5 backdrop-blur-sm border-[#E5C770]/30 hover:border-[#E5C770]/50 hover:shadow-[0_0_0_1px_rgba(229,199,112,0.4)] transition-all">
            <CardHeader className="flex flex-row items-center gap-3">
              <s.icon className="h-6 w-6 text-[#E5C770]" />
              <CardTitle className="text-lg">{s.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-white/85">{s.desc}</CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}