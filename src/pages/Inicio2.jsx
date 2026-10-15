import React from 'react';
import Inicio2Header from '@/components/inicio2/Inicio2Header';
import BatteryBanner from '@/components/inicio2/BatteryBanner';
import Inicio2Hero from '@/components/inicio2/Inicio2Hero';
import Inicio2ShippingFacts from '@/components/inicio2/Inicio2ShippingFacts';
import Inicio2Calculator from '@/components/inicio2/Inicio2Calculator';
import Inicio2Services from '@/components/inicio2/Inicio2Services';
import Inicio2Testimonials from '@/components/inicio2/Inicio2Testimonials';
import Inicio2Faq from '@/components/inicio2/Inicio2Faq';
import Inicio2Footer from '@/components/inicio2/Inicio2Footer';

export default function Inicio2() {
  return (
    <div className="-m-4 md:-m-6 lg:-m-8 min-h-screen bg-white">
      <Inicio2Header />
      <BatteryBanner />
      <Inicio2Hero />
      <Inicio2ShippingFacts />
      <Inicio2Calculator />
      <Inicio2Services />
      <Inicio2Testimonials />
      <Inicio2Faq />
      <Inicio2Footer />
    </div>
  );
}