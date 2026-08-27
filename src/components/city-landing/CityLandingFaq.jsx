import React, { useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { CITY_LANDINGS } from '@/lib/cityLandings';

// FAQ con datos estructurados JSON-LD (FAQPage schema) para rich snippets en Google.
export default function CityLandingFaq({ city }) {
  const faqs = [
    {
      q: `¿Cuánto cuesta el envío marítimo de China a ${city.city}?`,
      a: `El costo depende del volumen (CBM) de tu carga, la categoría (general o sensible) y el estado de destino (${city.state_name}). Usa nuestra calculadora en esta página para obtener un estimado instantáneo. Para cargas menores a 0.130 CBM aplicamos tarifas fijas por rango; para cargas mayores, el cálculo es volumen × tarifa por estado.`,
    },
    {
      q: `¿Cuánto tarda un envío marítimo de China a ${city.city}?`,
      a: `El tiempo de tránsito estimado es de ${city.transit_lcl} para carga consolidada (LCL) y ${city.transit_fcl} para contenedor completo (FCL), desde que el buque zarpa de China. El tiempo total desde que tu carga llega a nuestro almacén en Guangdong hasta que la recibes en ${city.city} es de aproximadamente 90 a 120 días, incluyendo consolidación y nacionalización.`,
    },
    {
      q: `¿Cómo hago para que mi compra en China llegue a ${city.city}?`,
      a: `Regístrate gratis en TLEC Cargo, obtén tu Shipping Mark (casillero único) y dáselo a tu proveedor en China (Alibaba, 1688, Taobao, etc.). Tu paquete llega a nuestro almacén en Guangdong, lo consolidamos con el resto de tu carga y lo enviamos por vía marítima a Venezuela con entrega puerta a puerta en ${city.city}.`,
    },
    {
      q: `¿Puedo asegurar mi carga de China a ${city.state_name}?`,
      a: `Sí. Ofrecemos seguro de carga opcional que cubre tu mercancía contra daños o pérdidas durante el tránsito. El seguro se calcula como un porcentaje del valor FOB declarado de tu mercancía. Puedes agregarlo al momento de consolidar tu envío.`,
    },
    {
      q: `¿Qué tipo de carga puedo enviar desde China a ${city.city}?`,
      a: `Aceptamos carga general (electrónica, ropa, accesorios, repuestos, hogar) y carga sensible/alto riesgo. También ofrecemos envío aéreo para cargas urgentes. Algunos artículos tienen restricciones aduanales; contáctanos si tienes dudas sobre un producto específico.`,
    },
    {
      q: `¿Hacen entrega puerta a puerta en ${city.state_name}?`,
      a: `Sí. Coordinamos la entrega final puerta a puerta en ${city.city} y toda la zona de ${city.state_name}. Para cargas menores a 0.130 CBM, el despacho final se realiza vía MRW con cobro en destino.`,
    },
  ];

  // JSON-LD structured data para rich snippets
  useEffect(() => {
    const scriptId = 'city-landing-faq-jsonld';
    let script = document.getElementById(scriptId);
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
    return () => {
      const el = document.getElementById(scriptId);
      if (el) el.remove();
    };
  }, [city.slug]);

  return (
    <section className="bg-slate-50 py-14" aria-labelledby="faq-heading">
      <div className="mx-auto max-w-4xl px-4">
        <h2 id="faq-heading" className="text-center font-display text-2xl font-extrabold text-slate-900 sm:text-3xl">
          Preguntas Frecuentes sobre envíos a {city.city}
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-500">
          Resolvemos las dudas más comunes sobre flete marítimo de China a {city.state_name}.
        </p>
        <div className="mt-8 space-y-3">
          {faqs.map((faq, i) => (
            <details key={i} className="group rounded-xl border border-slate-200 bg-white p-4">
              <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-slate-900">
                {faq.q}
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}