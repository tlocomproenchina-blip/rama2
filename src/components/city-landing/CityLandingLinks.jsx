import React from 'react';
import { Link } from 'react-router-dom';
import { CITY_LANDINGS, cityLandingPath } from '@/lib/cityLandings';
import { MapPin } from 'lucide-react';

// Enlaces internos a otras landings de ciudad — mejora indexación cruzada y retención.
export default function CityLandingLinks({ currentSlug }) {
  const others = CITY_LANDINGS.filter((c) => c.slug !== currentSlug).slice(0, 12);

  return (
    <nav aria-label="Otras ciudades con envío marítimo desde China" className="bg-white py-12">
      <div className="mx-auto max-w-5xl px-4">
        <h2 className="text-center font-display text-xl font-bold text-slate-900 sm:text-2xl">
          También enviamos marítimo desde China a estas ciudades
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-center text-sm text-slate-500">
          Cobertura puerta a puerta en toda Venezuela. Selecciona tu ciudad para ver tarifas y tiempos de tránsito.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {others.map((c) => (
            <Link
              key={c.slug}
              to={cityLandingPath(c.slug)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            >
              <MapPin className="h-4 w-4 shrink-0 text-blue-500" />
              <span className="truncate">{c.city}</span>
              <span className="ml-auto text-xs text-slate-400">{c.state_name}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}