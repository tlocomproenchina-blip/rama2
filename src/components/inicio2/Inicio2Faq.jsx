import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { HelpCircle } from 'lucide-react';

const faqs = [
  {
    q: '¿Cómo funciona el Casillero Virtual y cuánto cuesta?',
    a: 'El Casillero Virtual de TLEC Cargo para importar desde China es 100% gratuito. No cobramos mensualidad, afiliación ni registro. Al registrarte obtienes un código exclusivo de cliente (ej: TLEC-5540) y la dirección de nuestro almacén físico en Guangdong, China. Al comprar a tus proveedores de Alibaba, 1688, Pinduoduo, Weidian, etc, ingresas esa dirección. Nosotros recibimos tu mercancía, la registramos en sistema, la consolidamos y la llevamos mediante flete marítimo seguro hasta la puerta de tu casa u oficina en Venezuela.',
  },
  {
    q: '¿Tienen un mínimo de envío? ¿El servicio puerta a puerta tiene costo adicional?',
    a: 'No tenemos mínimo de envío: puedes mandar desde un lápiz hasta un contenedor completo, sin peso, volumen ni cantidad mínima de bultos. Todas nuestras cargas se entregan puerta a puerta en la dirección del cliente, incluido en la tarifa por volumen. No hay retiro en oficinas de encomiendas.',
  },
  {
    q: '¿Qué es la consolidacion y cómo me ayuda a ahorrar?',
    a: 'La consolidación en TLEC Cargo consiste en recibir las compras que realizas a distintos proveedores y unificar todos esos paquetes en uno solo. Esto te ayuda a ahorrar porque te permite pagar un único flete por toda tu mercancía agrupada, evitando los altos costos operativos y las tarifas mínimas de hacer envíos individuales por cada paquete.',
  },
  {
    q: '¿Cómo se calcula el costo del Envío Marítimo Consolidado?',
    a: 'El flete marítimo desde China se calcula por el volumen real de tu carga (CBM = largo × ancho × alto en metros cúbicos) y la tarifa varía según tu estado de destino en Venezuela. No hay mínimo de envío: se cobra el volumen real, sin importar lo pequeña que sea la carga, y la entrega final es puerta a puerta en tu dirección. Si tu carga pesa 400 kg o más, la tarifa por CBM se cobra al doble. Usa nuestra calculadora en esta misma página para estimar tu costo exacto al instante.',
  },
  {
    q: '¿Cuáles son las formas de pago aceptadas?',
    a: 'Aceptamos múltiples métodos de pago: Zelle, Binance Pay, USDT (TRC20), PayPal, Zinli, Wally, Wise, Skrill y Pago Móvil. El pago se realiza al momento de facturar tu carga, antes del despacho en Venezuela.',
  },
  {
    q: '¿Qué artículos están prohibidos enviar por aduana?',
    a: 'No se pueden enviar armas ni réplicas, municiones, explosivos, sustancias ilícitas, material inflamable, baterías de litio sueltas en grandes cantidades, dinero en efectivo, medicamentos sin permiso sanitario y artículos falsificados de marcas registradas. Si tienes dudas sobre un producto específico, consúltanos por WhatsApp antes de comprarlo.',
  },
  {
    q: '¿Puedo comprar en tiendas de China como Alibaba, 1688, Pinduoduo, Weidian?',
    a: 'Sí. Puedes comprar en Alibaba, 1688, Pinduoduo, Weidian, etc y cualquier tienda o proveedor chino que haga entregas dentro de China. Solo colocas la dirección de nuestro almacén en Guangdong como dirección de entrega, y nosotros nos encargamos del resto hasta tu puerta en Venezuela.',
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