import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { HelpCircle } from 'lucide-react';

const faqs = [
  {
    q: '¿Cómo funciona el Casillero Virtual y cuánto cuesta?',
    a: 'El Casillero Virtual de TLEC Cargo para importar desde China es 100% gratuito. No cobramos mensualidad, afiliación ni registro. Al registrarte obtienes un código exclusivo de cliente (ej: TLEC-5540) y la dirección de nuestro almacén físico en Yiwu, China. Al comprar a tus proveedores de Alibaba, 1688 o tiendas online como Temu y Shein, ingresas esa dirección. Nosotros recibimos tu mercancía, la registramos en sistema, la reempacamos gratis y la llevamos mediante flete marítimo seguro hasta la puerta de tu casa u oficina en Venezuela.',
  },
  {
    q: '¿Qué es el Reempaque Gratuito y cómo me ayuda a ahorrar?',
    a: 'Las tiendas suelen enviar cajas mucho más grandes de lo necesario. En nuestro almacén de Yiwu descartamos las cajas comerciales sobredimensionadas y consolidamos todas tus compras en una sola caja óptima. Esto reduce el volumen (CBM) de tu carga, que es lo que determina el costo del flete marítimo, ahorrándote dinero en cada envío.',
  },
  {
    q: '¿Cómo se calcula el costo del Envío Marítimo Consolidado?',
    a: 'El flete marítimo desde China se calcula por volumen (CBM = largo × ancho × alto en metros cúbicos) y la tarifa varía según tu estado de destino en Venezuela. Las cargas menores a 0.130 CBM tienen tarifas fijas por rango y llegan a nuestro almacén en Valencia con despacho vía MRW cobro destino. Usa nuestra calculadora en esta misma página para estimar tu costo exacto al instante.',
  },
  {
    q: '¿Cuáles son las formas de pago aceptadas?',
    a: 'Aceptamos múltiples métodos de pago: Zelle, Binance Pay, USDT (TRC20), PayPal, tarjetas internacionales vía Stripe, Zinli, Wally, Wise, Skrill y Pago Móvil. El pago se realiza al momento de facturar tu carga, antes del despacho en Venezuela.',
  },
  {
    q: '¿Qué artículos están prohibidos enviar por aduana?',
    a: 'No se pueden enviar armas ni réplicas, municiones, explosivos, sustancias ilícitas, material inflamable, baterías de litio sueltas en grandes cantidades, dinero en efectivo, medicamentos sin permiso sanitario y artículos falsificados de marcas registradas. Si tienes dudas sobre un producto específico, consúltanos por WhatsApp antes de comprarlo.',
  },
  {
    q: '¿Puedo comprar en tiendas de China como Alibaba, Temu, AliExpress o Shein?',
    a: 'Sí. Puedes comprar en Alibaba, 1688, Taobao, Pinduoduo, Weidian, Temu, AliExpress, Shein y cualquier tienda o proveedor chino que haga entregas dentro de China. Solo colocas la dirección de nuestro almacén en Yiwu como dirección de entrega, y nosotros nos encargamos del resto hasta tu puerta en Venezuela.',
  },
];

export default function Inicio2Faq() {
  return (
    <section id="preguntas2" className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-4">
        <div className="text-center">
          <HelpCircle className="mx-auto h-8 w-8 text-orange-500" />
          <h2 className="mt-4 font-display text-3xl font-extrabold text-slate-900 sm:text-4xl">Preguntas Frecuentes</h2>
          <p className="mt-3 text-slate-500">Despeja tus dudas y empieza a importar de manera rápida y sin complicaciones.</p>
        </div>
        <Accordion type="single" collapsible className="mt-10 space-y-4">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="rounded-2xl border border-slate-200 px-5 data-[state=open]:border-orange-300 data-[state=open]:bg-orange-50/30">
              <AccordionTrigger className="text-left text-sm font-bold text-slate-900 hover:no-underline sm:text-base">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-6 text-slate-600">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}