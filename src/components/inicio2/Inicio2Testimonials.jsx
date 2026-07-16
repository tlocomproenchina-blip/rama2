import React, { useRef } from 'react';
import { Star, BadgeCheck, ArrowLeft, ArrowRight } from 'lucide-react';

const testimonials = [
  {
    initials: 'CM', color: 'bg-sky-600', name: 'Carlos Mendoza', city: 'Caracas, Venezuela',
    text: '"Excelente servicio marítimo. Mi carga llegó completa y el reempaque consolidó mis 3 compras en una sola caja de manera impecable. Súper recomendados."',
    route: 'Yiwu → Caracas', item: 'Electrónica y Hogar',
  },
  {
    initials: 'AS', color: 'bg-emerald-600', name: 'Andrea Silva', city: 'Valencia, Venezuela',
    text: '"Importé por primera vez desde China con TLEC. La atención por WhatsApp fue muy clara y me mantuvieron informada con fotos de la carga en Yiwu. El flete marítimo consolidado es muy económico."',
    route: 'Yiwu → Valencia', item: 'Mercancía de Calzado',
  },
  {
    initials: 'RG', color: 'bg-orange-500', name: 'Roberto Gómez', city: 'Barquisimeto, Venezuela',
    text: '"Compro repuestos de moto a proveedores en China. El servicio de recepción en Yiwu y consolidación agrupó toda la carga. Llegó todo completo y sin ningún rasguño."',
    route: 'Yiwu → Barquisimeto', item: 'Repuestos Automotrices',
  },
];

export default function Inicio2Testimonials() {
  const scrollerRef = useRef(null);
  const scrollBy = (dir) => scrollerRef.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });

  return (
    <section className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-bold text-sky-700">
              <BadgeCheck className="h-3.5 w-3.5" /> CONFIANZA GARANTIZADA
            </span>
            <h2 className="mt-4 font-display text-3xl font-extrabold text-slate-900 sm:text-4xl">Testimonios de Clientes Verificados</h2>
            <p className="mt-3 max-w-xl text-slate-500">Descubre las experiencias de importadores comerciales y particulares que confían sus cargas de China a TLEC Cargo.</p>
          </div>
          <div className="hidden gap-2 sm:flex">
            <button onClick={() => scrollBy(-1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-400 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /></button>
            <button onClick={() => scrollBy(1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white hover:bg-zinc-800"><ArrowRight className="h-4 w-4" /></button>
          </div>
        </div>

        <div ref={scrollerRef} className="mt-10 flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory [-webkit-overflow-scrolling:touch]">
          {testimonials.map((t) => (
            <div key={t.name} className="w-[85%] shrink-0 snap-start rounded-3xl border border-slate-100 bg-white p-6 shadow-md sm:w-[340px]">
              <div className="flex items-center justify-between">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-orange-500 text-orange-500" />)}
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600">
                  <BadgeCheck className="h-3 w-3" /> VERIFICADO
                </span>
              </div>
              <p className="mt-4 text-sm italic leading-6 text-slate-600">{t.text}</p>
              <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${t.color} text-xs font-bold text-white`}>{t.initials}</div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-400">{t.city}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-[11px]">
                <div>
                  <p className="font-bold uppercase tracking-wider text-slate-400">Ruta / Envío</p>
                  <p className="mt-0.5 font-mono font-bold text-sky-700">{t.route}</p>
                </div>
                <div>
                  <p className="font-bold uppercase tracking-wider text-slate-400">Artículo</p>
                  <p className="mt-0.5 truncate font-semibold text-slate-700">{t.item}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}