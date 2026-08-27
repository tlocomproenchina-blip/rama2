import React from 'react';
import { Ship, Anchor, PackageCheck, Warehouse, ShieldCheck, MapPin } from 'lucide-react';

export default function CityLandingContent({ city }) {
  return (
    <section className="bg-white py-14">
      <div className="mx-auto max-w-5xl px-4">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-100 p-2.5"><Ship className="h-5 w-5 text-blue-600" /></div>
              <h2 className="font-display text-xl font-bold text-slate-900">Carga Consolidada (LCL)</h2>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Ideal para envíos pequeños y medianos. Compartes el espacio de un contenedor con otros importadores
              y pagas solo el volumen (CBM) que ocupas. Tu carga llega a {city.city} con un tiempo de tránsito
              estimado de <strong>{city.transit_lcl}</strong> desde que zarpa el buque desde China.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2"><PackageCheck className="h-4 w-4 text-blue-500" /> Facturación por CBM (volumen real)</li>
              <li className="flex items-center gap-2"><PackageCheck className="h-4 w-4 text-blue-500" /> Salidas semanales desde Guangdong</li>
              <li className="flex items-center gap-2"><PackageCheck className="h-4 w-4 text-blue-500" /> Entrega puerta a puerta en {city.city}</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-orange-100 p-2.5"><Anchor className="h-5 w-5 text-orange-600" /></div>
              <h2 className="font-display text-xl font-bold text-slate-900">Contenedor Completo (FCL)</h2>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Para volúmenes grandes o carga exclusiva. Reservas un contenedor completo (20ft o 40ft) solo para
              tu mercancía, con menor manipulación y tránsito estimado de <strong>{city.transit_fcl}</strong> hasta
              {city.city}. Recomendado para importadores con carga consolidada de alto volumen.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2"><PackageCheck className="h-4 w-4 text-orange-500" /> Contenedores 20ft y 40ft</li>
              <li className="flex items-center gap-2"><PackageCheck className="h-4 w-4 text-orange-500" /> Carga exclusiva, sin mezclar</li>
              <li className="flex items-center gap-2"><PackageCheck className="h-4 w-4 text-orange-500" /> Despacho directo a {city.state_name}</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-5 text-center">
            <Warehouse className="mx-auto h-6 w-6 text-blue-600" />
            <p className="mt-2 text-sm font-semibold text-slate-800">Almacén en Guangdong, China</p>
            <p className="text-xs text-slate-500">Recibimos y consolidamos tu carga</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-5 text-center">
            <ShieldCheck className="mx-auto h-6 w-6 text-emerald-600" />
            <p className="mt-2 text-sm font-semibold text-slate-800">Seguro de carga opcional</p>
            <p className="text-xs text-slate-500">Protege tu envío contra daños</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-5 text-center">
            <MapPin className="mx-auto h-6 w-6 text-orange-600" />
            <p className="mt-2 text-sm font-semibold text-slate-800">Entrega en {city.city}</p>
            <p className="text-xs text-slate-500">Puerta a puerta en {city.state_name}</p>
          </div>
        </div>
      </div>
    </section>
  );
}