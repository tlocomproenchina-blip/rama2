import React from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

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
    <div className="min-h-screen bg-white">
      <HomeHeader onLogin={handleAuthClick} />
      <Hero onLogin={handleAuthClick} />
      <RecentOperationsPanel user={user} />
      <React.Suspense fallback={<div className="px-4 py-16 text-center text-sm text-slate-500">Cargando contenido…</div>}>
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