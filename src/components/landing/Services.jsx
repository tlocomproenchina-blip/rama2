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
    <section className="mt-12">
      <h2 className="text-2xl font-bold mb-4 text-slate-900">Servicios</h2>
      <div className="grid gap-4 md:grid-cols-4">
        {items.map((s, i) => (
          <Card key={i} className="bg-white border-slate-200 hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center gap-3">
              <s.icon className="h-6 w-6 text-blue-700" />
              <CardTitle className="text-lg">{s.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-600">{s.desc}</CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}