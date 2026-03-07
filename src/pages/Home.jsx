import React from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

// New Home sections
import HomeHeader from '@/components/home/HomeHeader';
import Hero from '@/components/home/Hero';
import Features from '@/components/home/Features';
import Process from '@/components/home/Process';
import Services from '@/components/home/Services';
import Pricing from '@/components/home/Pricing';
import Testimonials from '@/components/home/Testimonials';
import FAQSection from '@/components/home/FAQSection';
import CTA from '@/components/home/CTA';
import HomeFooter from '@/components/home/HomeFooter';

export default function Home({ user }) {
  // Metadatos SEO para Home (pública)
  React.useEffect(() => {
    document.title = 'Envíos China → Venezuela | TLEC Logistics';
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
        const list = await base44.entities.StateConfig.filter({ is_active: true });
        setStates(list);
      } catch (e) {
        console.error('Error cargando estados', e);
      }
    })();
  }, []);

  const handleAuthClick = () => {
    try {setAuthLoading(true);} catch {}
    base44.auth.redirectToLogin();
  };



  return (
    <div className="min-h-screen bg-white">
      <HomeHeader onLogin={handleAuthClick} />
      <Hero onLogin={handleAuthClick} />
      <Features />
      <Process />
      <Services />
      <Pricing states={states} selectedCode={selectedCode} setSelectedCode={setSelectedCode} />
      <Testimonials />
      <FAQSection />
      <CTA />
      <HomeFooter />
    </div>);

}