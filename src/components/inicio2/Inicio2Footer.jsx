import React from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { CITY_LANDINGS, cityLandingPath } from '@/lib/cityLandings';


export default function Inicio2Footer() {
  return (
    <footer className="bg-zinc-950 text-zinc-400">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <div className="rounded-3xl bg-gradient-to-r from-orange-600 to-orange-500 px-6 py-10 text-center text-white sm:px-12">
          <h3 className="font-display text-2xl font-extrabold sm:text-3xl">¿Listo para importar desde China?</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-orange-100">Abre tu casillero gratis en Yiwu, China y recibe tus compras en la puerta de tu casa en Venezuela.</p>
          <button
            onClick={() => base44.auth.redirectToLogin(createPageUrl('ClientPortal'))}
            className="mt-6 rounded-xl bg-white px-8 py-3 text-sm font-bold text-orange-600 shadow-lg hover:bg-orange-50"
          >
            Crear Casillero Gratis
          </button>
        </div>

        {/* Cobertura Marítima Nacional */}
        <div className="mt-12 border-t border-white/10 pt-8">
          <h4 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-white">Cobertura Marítima Nacional</h4>
          <p className="mt-1 text-xs text-zinc-500">Envíos marítimos desde China a las principales ciudades de Venezuela.</p>
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
            {CITY_LANDINGS.map((c) => (
              <Link
                key={c.slug}
                to={cityLandingPath(c.slug)}
                className="text-zinc-400 transition-colors hover:text-orange-400"
              >
                {c.city}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
          <div className="flex items-center gap-2">
            <img
              src="https://media.base44.com/images/public/695da428c9924ef9b68e8866/52211ee9d_f747206d-9aac-45da-b57b-eecb77f854af.jpg"
              alt="TLEC Cargo"
              className="h-8 w-8 rounded-lg object-cover"
            />
            <p className="font-display text-sm font-extrabold text-white">TL<span className="text-orange-500">E</span>C CARGO</p>
          </div>
          <p className="text-xs">© {new Date().getFullYear()} TLEC Cargo. Envíos marítimos de China a Venezuela.</p>
        </div>
      </div>
    </footer>
  );
}