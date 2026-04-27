import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Package, Globe2, Shield, Users } from 'lucide-react';
import HomeHeader from '@/components/home/HomeHeader';
import HomeFooter from '@/components/home/HomeFooter';

export default function About() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <HomeHeader />
      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 md:py-16">
        <header className="mb-10">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-slate-800">
            Sobre TLEC CARGO
          </h1>
          <p className="mt-3 text-lg text-slate-500">
            Quiénes somos, qué hacemos y para quién trabajamos.
          </p>
        </header>

        <section className="prose prose-slate max-w-none space-y-5 text-slate-700 leading-relaxed">
          <p>
            <strong>TLEC CARGO</strong> es una plataforma de logística internacional especializada
            en consolidar y enviar paquetes desde China hacia Venezuela de forma rápida, segura y
            transparente. Conectamos a importadores, emprendedores y consumidores con almacenes,
            transportistas y operadores aduaneros, integrando todo el proceso —desde la pre-alerta
            del paquete en origen hasta la entrega final en destino— en una sola aplicación.
          </p>
          <p>
            Nuestro sistema permite a cada cliente registrar sus paquetes por adelantado mediante
            un Shipping Mark único, recibirlos en nuestro almacén, consolidarlos por vía aérea o
            marítima, calcular tarifas con total claridad, gestionar seguros opcionales, generar
            facturas, pagar con múltiples métodos (incluyendo Stripe, PayPal, USDT, Zelle y pago
            móvil) y hacer seguimiento en tiempo real de cada envío con notificaciones push y por
            correo electrónico.
          </p>
          <p>
            Está pensado para <strong>importadores frecuentes</strong>, <strong>tiendas online</strong>,
            <strong> emprendedores</strong> que compran inventario en plataformas como Alibaba, 1688,
            Taobao o Shein, y <strong>familias</strong> que reciben encomiendas personales. También
            ofrecemos un programa de referidos que recompensa a quienes traen nuevos clientes a la
            comunidad TLEC.
          </p>
          <p>
            La plataforma es construida y operada por el equipo de <strong>TLEC CARGO</strong>, una
            empresa con experiencia comprobada en logística entre Asia y Latinoamérica. Nuestro
            compromiso es ofrecer tarifas justas, soporte cercano por WhatsApp y tickets, y
            tecnología que elimine la incertidumbre típica del envío internacional.
          </p>
        </section>

        <section className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: Package, title: 'Consolidación inteligente', text: 'Agrupamos múltiples paquetes en un solo envío para reducir costos.' },
            { icon: Globe2, title: 'Cobertura internacional', text: 'Operaciones aéreas y marítimas desde China hacia toda Venezuela.' },
            { icon: Shield, title: 'Seguro opcional', text: 'Protege tu carga con cobertura sobre el valor FOB declarado.' },
            { icon: Users, title: 'Soporte humano', text: 'Atención por WhatsApp, tickets y email en horario extendido.' },
          ].map((item, i) => (
            <Card key={i} className="border-0 shadow-card">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{item.title}</h3>
                  <p className="text-sm text-slate-500 mt-1">{item.text}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mt-12 flex flex-col sm:flex-row gap-3">
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link to={createPageUrl('Contact')}>Contáctanos</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={createPageUrl('Rates')}>Ver tarifas</Link>
          </Button>
        </section>
      </main>
      <HomeFooter />
    </div>
  );
}