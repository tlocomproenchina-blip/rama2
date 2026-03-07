import React from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Ship, Plane, Package, ShieldCheck, Clock, MapPin, ArrowRight, Loader2 } from 'lucide-react';
import HomeHeroVideo from '@/components/landing/HomeHeroVideo.jsx';
import Benefits from '@/components/landing/Benefits.jsx';
import Process from '@/components/landing/Process.jsx';
import Services from '@/components/landing/Services.jsx';
import RatesTeaser from '@/components/landing/RatesTeaser.jsx';
import Testimonials from '@/components/landing/Testimonials.jsx';
import FAQTeaser from '@/components/landing/FAQTeaser.jsx';
import FinalCTA from '@/components/landing/FinalCTA.jsx';

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
    <div className="min-h-screen">
      {/* Hero */}
      <HomeHeroVideo onAuthClick={handleAuthClick} authLoading={authLoading} />

      {/* Beneficios */}
      <Benefits />

      {/* Proceso */}
      <Process />

      {/* Servicios */}
      <Services />

      {/* Tarifas */}
      <RatesTeaser states={states} selectedCode={selectedCode} setSelectedCode={setSelectedCode} />

      {/* Testimonios */}
      <Testimonials />

      {/* FAQ */}
      <FAQTeaser />

      {/* Llamado */}
      <FinalCTA />
    </div>);

}