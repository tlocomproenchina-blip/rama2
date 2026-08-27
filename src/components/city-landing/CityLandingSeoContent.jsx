import React from 'react';
import { Ship, Warehouse, ShieldCheck, Truck, FileText, Boxes } from 'lucide-react';

// Contenido SEO rico y único por ciudad. Texto largo, keywords de cola larga,
// semántica HTML5 correcta (<article>, <section>, headings jerárquicos).
export default function CityLandingSeoContent({ city }) {
  const cityLower = city.city.toLowerCase();
  const stateLower = city.state_name.toLowerCase();

  return (
    <article className="bg-white py-14">
      <div className="mx-auto max-w-4xl px-4">
        {/* Intro — párrafo largo con keywords naturales */}
        <section aria-labelledby="seo-intro">
          <h2 id="seo-intro" className="font-display text-2xl font-extrabold text-slate-900 sm:text-3xl">
            Cómo importar desde China a {city.city} por vía marítima
          </h2>
          <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-slate-600">
            <p>
              Si buscas <strong>importar productos desde China a {city.city}, {city.state_name}</strong>, el
              envío marítimo es la opción más económica y segura para volúmenes medianos y grandes. En TLEC Cargo
              consolidamos tu carga en nuestro almacén de Guangdong —uno de los mayores polos industriales del mundo— y la
              transportamos en contenedores hasta Venezuela, con entrega puerta a puerta en {city.city} y toda la
              región de {city.state_name}. El tiempo de tránsito estimado es de{' '}
              <strong>{city.transit_lcl}</strong> para carga consolidada (LCL) y <strong>{city.transit_fcl}</strong>{' '}
              para contenedor completo (FCL), contado desde que el buque zarpa desde el puerto chino.
            </p>
            <p>
              Nuestro servicio de <strong>flete marítimo de China a {city.city}</strong> está diseñado para
              importadores frecuentes, tiendas online, emprendedores y familias que compran en plataformas como
              Alibaba, 1688, Taobao, Shein o AliExpress. Solo necesitas tu <strong>Shipping Mark</strong> (casillero
              único) para que tus paquetes lleguen a nuestros almacenes en China; nosotros nos encargamos de la
              consolidación, el transporte, la aduana y la entrega final en {city.city}.
            </p>
          </div>
        </section>

        {/* Por qué elegir marítimo */}
        <section aria-labelledby="seo-why" className="mt-10">
          <h3 id="seo-why" className="font-display text-xl font-bold text-slate-900">
            ¿Por qué elegir el envío marítimo a {city.city}?
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <Boxes className="h-5 w-5 shrink-0 text-blue-600" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Menor costo por volumen</p>
                <p className="mt-1 text-xs text-slate-500">
                  El flete marítimo a {city.city} se factura por CBM (metro cúbico), no por peso. Ideal para carga
                  pesada o voluminosa que saldría muy cara por aire.
                </p>
              </div>
            </div>
            <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Carga asegurada opcional</p>
                <p className="mt-1 text-xs text-slate-500">
                  Protege tu mercancía contra daños o pérdidas durante el tránsito desde China hasta {city.state_name}.
                </p>
              </div>
            </div>
            <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <Truck className="h-5 w-5 shrink-0 text-orange-600" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Entrega puerta a puerta</p>
                <p className="mt-1 text-xs text-slate-500">
                  Recibes tu carga directamente en {city.city} sin gestionar múltiples transportistas ni aduanas.
                </p>
              </div>
            </div>
            <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <FileText className="h-5 w-5 shrink-0 text-sky-600" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Facturación transparente</p>
                <p className="mt-1 text-xs text-slate-500">
                  Ver el costo exacto antes de enviar. Sin cargos ocultos ni sorpresas al llegar a {city.city}.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Cómo funciona — pasos */}
        <section aria-labelledby="seo-process" className="mt-10">
          <h3 id="seo-process" className="font-display text-xl font-bold text-slate-900">
            Cómo funciona el envío de China a {city.city} paso a paso
          </h3>
          <ol className="mt-4 space-y-4">
            {[
              { icon: FileText, title: '1. Crea tu casillero gratis', text: `Regístrate en TLEC Cargo y obtén tu Shipping Mark único. Tus proveedores en China deben etiquetar todos tus paquetes con ese código para que lleguen a nuestro almacén de Guangdong.` },
              { icon: Warehouse, title: '2. Recibimos tu carga en Guangdong', text: `Tu mercancía llega a nuestro almacén en China. Pesamos, medimos y fotografiamos cada paquete. Puedes ver todo desde tu panel.` },
              { icon: Ship, title: '3. Consolidamos y enviamos', text: `Agrupamos tus paquetes con otros envíos hacia Venezuela en un contenedor marítimo. El buque zarpa rumbo a Venezuela con destino a ${city.state_name}.` },
              { icon: Truck, title: `4. Entrega en ${city.city}`, text: `Tras la llegada y nacionalización, coordinamos la entrega puerta a puerta en ${city.city}. Recibes notificaciones push y por email en cada etapa.` },
            ].map((step, i) => (
              <li key={i} className="flex gap-4 rounded-xl border border-slate-200 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100">
                  <step.icon className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{step.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Texto SEO largo adicional */}
        <section aria-labelledby="seo-long" className="mt-10">
          <h3 id="seo-long" className="font-display text-xl font-bold text-slate-900">
            Flete marítimo {city.city} — preguntas frecuentes sobre costos y tiempos
          </h3>
          <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-slate-600">
            <p>
              El <strong>costo de enviar un contenedor desde China a {city.city}</strong> depende del volumen real
              (CBM) de tu carga, la categoría (general o sensible/alto riesgo) y el estado de destino. Para cargas
              menores a 0.130 CBM aplicamos tarifas fijas por rango que incluyen recepción en nuestro almacén de
              Valencia; el despacho final a {city.city} se realiza vía MRW con cobro en destino. Para cargas mayores,
              el cálculo es simple: <em>volumen CBM × tarifa por estado</em>, con un recargo del 100% (x2) si el peso
              real supera los 499 kg.
            </p>
            <p>
              ¿Cuánto tarda un envío marítimo de China a {city.state_name}? El tiempo de tránsito estimado es de{' '}
              <strong>{city.transit_lcl}</strong> para LCL (consolidado) y <strong>{city.transit_fcl}</strong> para FCL
              (contenedor completo), contado desde la salida del buque. A esto se suma el tiempo de consolidación en
              China (1–2 semanas) y la nacionalización en Venezuela. El total aproximado desde que tu carga llega a
              nuestro almacén en Guangdong hasta que la recibes en {city.city} es de 90 a 120 días.
            </p>
            <p>
              En TLEC Cargo también ofrecemos <strong>envío aéreo de China a {city.city}</strong> para cargas
              urgentes o de alto valor, con un tiempo de tránsito de 15 a 20 días. La calculadora de esta página te
              da el estimado marítimo; contáctanos para una cotización aérea personalizada.
            </p>
          </div>
        </section>
      </div>
    </article>
  );
}