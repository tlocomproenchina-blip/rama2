import React from 'react';
import { UserPlus, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { cityLandingPath } from '@/lib/cityLandings';

export default function CityLandingCta({ city, user }) {
  const handleRegister = () => {
    // Pasamos la ciudad como query param para guardarla en el perfil tras el registro.
    const nextUrl = `${cityLandingPath(city.slug)}?origin_city=${encodeURIComponent(city.slug)}`;
    base44.auth.redirectToLogin(nextUrl);
  };

  return (
    <section className="bg-slate-50 py-14">
      <div className="mx-auto max-w-4xl px-4">
        <div className="rounded-3xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-10 text-center text-white shadow-premium sm:px-12">
          <h2 className="font-display text-2xl font-extrabold sm:text-3xl">
            Regístrate y Abre tu Casillero Marítimo
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-blue-100">
            Crea tu cuenta gratis en TLEC Cargo y empieza a recibir tus compras desde China en {city.city}.
            Tu ciudad se guarda automáticamente en tu perfil.
          </p>
          <button
            onClick={handleRegister}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3 text-sm font-bold text-blue-700 shadow-lg hover:bg-blue-50"
          >
            <UserPlus className="h-4 w-4" /> {user ? 'Ir a mi panel' : 'Crear Casillero Gratis'}
          </button>
        </div>
        <div className="mt-6 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            Conoce más sobre TLEC Cargo <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}