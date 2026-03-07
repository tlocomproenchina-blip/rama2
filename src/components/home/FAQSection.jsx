import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const faqs = [
  { q: '¿Cuánto tarda el envío marítimo vs aéreo?', a: 'Marítimo suele tardar más pero reduce costo/CBM; aéreo es más rápido para cargas urgentes.' },
  { q: '¿Puedo consolidar paquetes de diferentes proveedores?', a: 'Sí, consolidamos en nuestro almacén de China para optimizar volumen y seguridad.' },
  { q: '¿Qué documentación necesito?', a: 'Factura/comercial y datos del destinatario; te asesoramos en requisitos aduaneros.' },
  { q: '¿Ofrecen seguro?', a: 'Sí, seguro opcional calculado sobre el valor FOB.' },
];

export default function FAQSection() {
  return (
    <section id="faq" className="py-12">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-3xl font-black text-slate-900 mb-6">Preguntas frecuentes</h2>
        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="rounded-2xl border bg-gradient-to-r from-white to-blue-50">
              <AccordionTrigger className="px-4 text-left hover:no-underline">{f.q}</AccordionTrigger>
              <AccordionContent className="px-4 text-slate-600">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}