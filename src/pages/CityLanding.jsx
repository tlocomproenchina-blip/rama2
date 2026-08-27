import React, { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { CITY_LANDINGS, getCityBySlug } from '@/lib/cityLandings';
import Inicio2Header from '@/components/inicio2/Inicio2Header';
import Inicio2Footer from '@/components/inicio2/Inicio2Footer';
import CityLandingHero from '@/components/city-landing/CityLandingHero';
import CityLandingContent from '@/components/city-landing/CityLandingContent';
import CityLandingCta from '@/components/city-landing/CityLandingCta';
import { Loader2 } from 'lucide-react';

// Calculadora existente reutilizada (lazy para no afectar bundle de la landing)
const ShippingCalculator = React.lazy(() => import('@/pages/ShippingCalculator'));

function setMetaTag(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function applySeo(city) {
  const title = `Envíos Marítimos desde China a ${city.city} | TLEC Cargo`;
  const description = `Envíos marítimos de China a ${city.city}, ${city.state_name}. Carga consolidada (LCL) y contenedor completo (FCL) con entrega puerta a puerta, seguro opcional y seguimiento en tiempo real.`;
  document.title = title;
  setMetaTag('name', 'description', description);
  setMetaTag('property', 'og:title', title);
  setMetaTag('property', 'og:description', description);
  setMetaTag('property', 'og:type', 'website');
  const canonical = `${window.location.origin}/envios-maritimos-china-${city.slug}`;
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', canonical);
}

export default function CityLanding({ user }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const city = useMemo(() => getCityBySlug(slug), [slug]);

  // Tracking de visita (fire-and-forget) + guardado de origin_city tras registro
  useEffect(() => {
    if (!city) return;

    applySeo(city);

    // 1. Analítica de plataforma
    try {
      base44.analytics.track({
        eventName: 'city_landing_view',
        properties: { city: city.city, slug: city.slug, state: city.state_name }
      });
    } catch (_) {}

    // 2. Contador para el dashboard admin (backend, no bloquea)
    base44.functions
      .invoke('trackCityLandingView', { slug: city.slug, city: city.city, state_name: city.state_name })
      .catch(() => {});

    // 3. Si viene con ?origin_city= tras registrarse, guardar en perfil y redirigir
    const params = new URLSearchParams(window.location.search);
    const originCity = params.get('origin_city');
    if (originCity && user) {
      base44.auth
        .updateMe({ origin_city: city.slug, origin_city_name: city.city })
        .then(() => navigate('/Dashboard', { replace: true }))
        .catch(() => navigate('/Dashboard', { replace: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city?.slug, user?.id]);

  if (!city) {
    return (
      <div className="-m-4 md:-m-6 lg:-m-8 min-h-screen bg-white">
        <Inicio2Header />
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <p className="font-display text-2xl font-bold text-slate-800">Ciudad no encontrada</p>
          <p className="mt-2 text-sm text-slate-500">La landing que buscas no existe.</p>
          <a href="/" className="mt-6 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700">
            Volver al inicio
          </a>
        </div>
        <Inicio2Footer />
      </div>
    );
  }

  return (
    <div className="-m-4 md:-m-6 lg:-m-8 min-h-screen bg-white">
      <Inicio2Header />
      <CityLandingHero city={city} />
      <CityLandingContent city={city} />

      {/* Calculadora marítima integrada con ciudad preseleccionada */}
      <section id="calculadora" className="bg-slate-50 py-14">
        <div className="mx-auto max-w-3xl px-4">
          <div className="mb-6 text-center">
            <h2 className="font-display text-2xl font-extrabold text-slate-900 sm:text-3xl">
              Calcula tu Envío Marítimo a {city.city}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Estimación instantánea del costo de tu carga desde China hasta {city.state_name}.
            </p>
          </div>
          <React.Suspense fallback={
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
          }>
            <ShippingCalculator
              user={user}
              defaultStateCode={city.state_code}
              defaultShippingType="maritimo"
            />
          </React.Suspense>
        </div>
      </section>

      <CityLandingCta city={city} user={user} />
      <Inicio2Footer />
    </div>
  );
}