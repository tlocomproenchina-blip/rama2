import React from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import PremiumLoader from '@/components/common/PremiumLoader';

// Above-the-fold sections
import HomeHeader from '@/components/home/HomeHeader';
import Hero from '@/components/home/Hero';
import FAQSection from '@/components/home/FAQSection';
import RecentOperationsPanel from '@/components/home/RecentOperationsPanel';

// Below-the-fold sections
const Features = React.lazy(() => import('@/components/home/Features'));
const Process = React.lazy(() => import('@/components/home/Process'));
const Services = React.lazy(() => import('@/components/home/Services'));
const Pricing = React.lazy(() => import('@/components/home/Pricing'));
const Testimonials = React.lazy(() => import('@/components/home/Testimonials'));
const HomeFooter = React.lazy(() => import('@/components/home/HomeFooter'));

export default function Home({ user }) {
  // Metadatos SEO para Home (pública)
  React.useEffect(() => {
    document.title = 'Envíos China → Venezuela | TLEC CARGO';
    const meta = document.querySelector('meta[name="description"]') || document.createElement('meta');
    meta.name = 'description';
    meta.content = 'Transporte puerta a puerta desde China a Venezuela: consolidación, tarifas claras y soporte experto.';
    document.head.appendChild(meta);
  }, []);

  const [states, setStates] = React.useState([]);
  const [selectedCode, setSelectedCode] = React.useState('');
  const [authLoading, setAuthLoading] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.StateConfig.filter({ is_active: true }, 'state_name', 50);
        setStates(list);
      } catch (e) {
        console.error('Error cargando estados', e);
      }
    })();
  }, []);

  const handleAuthClick = () => {
    try { setAuthLoading(true); } catch {}
    base44.auth.redirectToLogin(createPageUrl('ClientPortal'));
  };



  return (
    <div className="min-h-screen bg-background">
      <HomeHeader onLogin={handleAuthClick} />
      <Hero onLogin={handleAuthClick} />
      {user?.role === 'user' && (
        <div className="px-4 pt-4 md:px-6 lg:px-8">
          <div className="mx-auto max-w-screen-sm">
            <div className="rounded-3xl border border-border/70 bg-white/90 p-4 shadow-card backdrop-blur">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/70">Acceso rápido</p>
                  <h2 className="mt-1 text-lg font-bold text-foreground">Entrar al portal del cliente</h2>
                  <p className="text-sm text-muted-foreground">Consulta paquetes, facturas, soporte y perfil desde una experiencia móvil más directa.</p>
                </div>
                <Link to={createPageUrl('Dashboard')}>
                  <Button className="w-full sm:w-auto">Abrir portal</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
      <RecentOperationsPanel user={user} />
      <React.Suspense fallback={<PremiumLoader title="Cargando contenido" description="Estamos preparando la experiencia visual de la página principal." />}>
        <Features />
        <Process />
        <Services />
        <Pricing states={states} selectedCode={selectedCode} setSelectedCode={setSelectedCode} />
        <Testimonials />
        <FAQSection />
        <HomeFooter />
      </React.Suspense>
    </div>);

}