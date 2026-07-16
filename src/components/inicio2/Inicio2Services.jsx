import React from 'react';
import { Ship, Package, ShieldCheck, CheckCircle2 } from 'lucide-react';

const services = [
  {
    icon: Ship, color: 'bg-sky-50 text-sky-600', tag: 'IDEAL PARA VOLUMEN',
    title: 'Envío Marítimo Consolidado',
    desc: 'Salidas quincenales para cargas pesadas o compras de gran tamaño. Una solución sumamente económica y confiable.',
    details: ['Tiempo China: 75 a 90 días estimados de navegación.', 'Tarifa por CBM según tu estado de destino — calcúlala arriba en segundos.'],
    ideal: 'Cajas de alimentos, electrodomésticos, muebles, mudanzas y carga comercial.',
  },
  {
    icon: Package, color: 'bg-emerald-50 text-emerald-600', tag: '100% GRATUITO',
    title: 'Consolidación',
    desc: 'Combinamos tus compras de múltiples tiendas (Alibaba, 1688, Temu, Shein, etc.) en una sola caja óptima para reducir peso volumétrico.',
    details: ['Descarte de cajas comerciales sobredimensionadas.', 'Agrupación en una sola guía para fácil rastreo.'],
    ideal: 'Compras variadas en múltiples tiendas durante la misma semana.',
  },
  {
    icon: ShieldCheck, color: 'bg-blue-50 text-blue-600', tag: 'TRANQUILIDAD TOTAL',
    title: 'Seguro de Carga y Soporte',
    desc: 'Protegemos tus compras desde que ingresan a nuestro almacén en Yiwu, China hasta que las recibes en tus manos en Venezuela.',
    details: ['Inspección rápida de contenido al recibir en Yiwu.', 'Seguro premium por valor declarado.', 'Fotos y alertas de estado en app.'],
    ideal: 'Mercancía delicada o de alto valor declarado.',
  },
];

export default function Inicio2Services() {
  return (
    <section id="servicios2" className="bg-slate-100/70 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-500">Servicios de Primera</p>
          <h2 className="mt-3 font-display text-3xl font-extrabold text-slate-900 sm:text-4xl">Soluciones de carga a tu medida</h2>
          <p className="mx-auto mt-3 max-w-lg text-slate-500">Ofrecemos tarifas claras, seguridad absoluta y la mejor logística para que importar a Venezuela sea fácil y accesible.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {services.map((s) => (
            <div key={s.title} className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-start justify-between gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${s.color}`}>
                  <s.icon className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold tracking-wide text-slate-500">{s.tag}</span>
              </div>
              <h3 className="mt-5 font-display text-xl font-bold text-slate-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{s.desc}</p>
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Detalles del servicio</p>
                <ul className="mt-2 space-y-2">
                  {s.details.map((d) => (
                    <li key={d} className="flex items-start gap-2 text-sm text-slate-600">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {d}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Ideal para:</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{s.ideal}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}