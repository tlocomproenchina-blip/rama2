import React, { useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { CITY_LANDINGS, getCityBySlug } from '@/lib/cityLandings';
import Inicio2Header from '@/components/inicio2/Inicio2Header';
import Inicio2Footer from '@/components/inicio2/Inicio2Footer';
import CityLandingHero from '@/components/city-landing/CityLandingHero';
import CityLandingContent from '@/components/city-landing/CityLandingContent';
import CityLandingCta from '@/components/city-landing/CityLandingCta';
import CityLandingSeoContent from '@/components/city-landing/CityLandingSeoContent';
import CityLandingFaq from '@/components/city-landing/CityLandingFaq';
import CityLandingLinks from '@/components/city-landing/CityLandingLinks';
import Inicio2Calculator from '@/components/inicio2/Inicio2Calculator';
import { Loader2 } from 'lucide-react';

function setMetaTag(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function removeMetaTag(attr, key) {
  const el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (el) el.remove();
}

function applySeo(city) {
  const title = `Envíos Marítimos desde China a ${city.city} | TLEC Cargo`;
  const description = `Envíos marítimos de China a ${city.city}, ${city.state_name}. Carga consolidada (LCL) y contenedor completo (FCL) con entrega puerta a puerta, seguro opcional y seguimiento en tiempo real. Tránsito ${city.transit_lcl}.`;
  const canonical = `${window.location.origin}/envios-maritimos-china-${city.slug}`;
  const keywords = `envíos marítimos China ${city.city}, flete China ${city.state_name}, importar desde China a ${city.city}, casillero ${city.city}, carga consolidada China Venezuela, contenedor China ${city.city}, LCL FCL China ${city.state_name}`;

  document.title = title;

  // Meta tags básicos
  setMetaTag('name', 'description', description);
  setMetaTag('name', 'keywords', keywords);
  setMetaTag('name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
  setMetaTag('name', 'author', 'TLEC Cargo');

  // Geo tags — ayudan a Google a asociar la página con la ubicación
  setMetaTag('name', 'geo.region', 'VE');
  setMetaTag('name', 'geo.placename', `${city.city}, ${city.state_name}`);
  setMetaTag('name', 'geo.position', `${city.lat || ''};${city.lng || ''}`);
  setMetaTag('name', 'ICBM', `${city.lat || ''}, ${city.lng || ''}`);

  // Open Graph
  setMetaTag('property', 'og:title', title);
  setMetaTag('property', 'og:description', description);
  setMetaTag('property', 'og:type', 'website');
  setMetaTag('property', 'og:url', canonical);
  setMetaTag('property', 'og:site_name', 'TLEC Cargo');
  setMetaTag('property', 'og:locale', 'es_VE');
  setMetaTag('property', 'og:image', 'https://media.base44.com/images/public/695da428c9924ef9b68e8866/52211ee9d_f747206d-9aac-45da-b57b-eecb77f854af.jpg');

  // Twitter Cards
  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', title);
  setMetaTag('name', 'twitter:description', description);
  setMetaTag('name', 'twitter:image', 'https://media.base44.com/images/public/695da428c9924ef9b68e8866/52211ee9d_f747206d-9aac-45da-b57b-eecb77f854af.jpg');

  // Canonical
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', canonical);

  // JSON-LD: Service + LocalBusiness
  const jsonLdId = 'city-landing-jsonld';
  let script = document.getElementById(jsonLdId);
  if (!script) {
    script = document.createElement('script');
    script.id = jsonLdId;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        name: `Envío Marítimo de China a ${city.city}`,
        serviceType: 'Freight forwarding — Maritime shipping',
        provider: { '@type': 'Organization', name: 'TLEC Cargo', url: window.location.origin },
        areaServed: { '@type': 'State', name: city.state_name, containedInPlace: { '@type': 'Country', name: 'Venezuela' } },
        description: `Consolidación y envío marítimo de carga desde China (Guangdong) a ${city.city}, ${city.state_name}. LCL y FCL con entrega puerta a puerta.`,
        url: canonical,
      },
      {
        '@type': 'LocalBusiness',
        name: 'TLEC Cargo',
        description: `Envíos marítimos y aéreos desde China a ${city.city}, ${city.state_name}.`,
        url: window.location.origin,
        areaServed: city.state_name,
        knowsAbout: ['Envíos marítimos', 'Importación desde China', 'Carga consolidada LCL', 'Contenedor completo FCL'],
      },
    ],
  });
}

function cleanupSeo() {
  removeMetaTag('name', 'keywords');
  removeMetaTag('name', 'robots');
  removeMetaTag('name', 'author');
  removeMetaTag('name', 'geo.region');
  removeMetaTag('name', 'geo.placename');
  removeMetaTag('name', 'geo.position');
  removeMetaTag('name', 'ICBM');
  removeMetaTag('property', 'og:site_name');
  removeMetaTag('property', 'og:locale');
  removeMetaTag('property', 'og:image');
  removeMetaTag('name', 'twitter:card');
  removeMetaTag('name', 'twitter:title');
  removeMetaTag('name', 'twitter:description');
  removeMetaTag('name', 'twitter:image');
  const jsonLd = document.getElementById('city-landing-jsonld');
  if (jsonLd) jsonLd.remove();
}

export default function CityLanding({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const slug = useMemo(() => {
    const path = location.pathname.replace(/^\/+/, '');
    const prefix = 'envios-maritimos-china-';
    if (path.startsWith(prefix)) return path.slice(prefix.length);
    return '';
  }, [location.pathname]);
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

    return () => cleanupSeo();
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
        <div className="mx-auto max-w-6xl px-4">
          <Inicio2Calculator defaultStateCode={city.state_code} />
        </div>
      </section>

      <CityLandingSeoContent city={city} />
      <CityLandingFaq city={city} />
      <CityLandingLinks currentSlug={city.slug} />
      <CityLandingCta city={city} user={user} />
      <Inicio2Footer />
    </div>
  );
}