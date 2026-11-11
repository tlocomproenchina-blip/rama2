import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Package, Globe2, Shield, Users } from 'lucide-react';
import PublicPageShell from '@/components/public/PublicPageShell';

const HIGHLIGHTS = [
  { icon: Package, title: 'Consolidación inteligente', text: 'Agrupamos múltiples paquetes en un solo envío para reducir costos.' },
  { icon: Globe2, title: 'Cobertura internacional', text: 'Operaciones aéreas y marítimas desde China hacia toda Venezuela.' },
  { icon: Shield, title: 'Seguro opcional', text: 'Protege tu carga con cobertura sobre el valor FOB declarado.' },
  { icon: Users, title: 'Soporte humano', text: 'Atención por WhatsApp, tickets y email en horario extendido.' },
];

export default function About() {
  return (
    <PublicPageShell
      eyebrow="Nosotros"
      title="Sobre IMPORTACIONES TLEC CARGO"
      description="Quiénes somos, qué hacemos y para quién trabajamos."
      width="max-w-4xl"
    >
      <section className="space-y-5 leading-relaxed text-muted-foreground">
        <p>
          <strong className="text-foreground">IMPORTACIONES TLEC CARGO</strong> es una plataforma de logística internacional especializada
          en consolidar y enviar paquetes desde China hacia Venezuela de forma rápida, segura y
          transparente. Conectamos a importadores, emprendedores y consumidores con almacenes,
          transportistas y operadores aduaneros, integrando todo el proceso —desde la pre-alerta
          del paquete en origen hasta la entrega final en destino— en una sola aplicación.
        </p>
        <p>
          Nuestro sistema permite a cada cliente registrar sus paquetes por adelantado mediante
          un Shipping Mark único, recibirlos en nuestro almacén, consolidarlos por vía aérea o
          marítima, calcular tarifas con total claridad, gestionar seguros opcionales, generar
          facturas, pagar con múltiples métodos (incluyendo PayPal, USDT, Zelle y pago
          móvil) y hacer seguimiento en tiempo real de cada envío con notificaciones push y por
          correo electrónico.
        </p>
        <p>
          Está pensado para <strong className="text-foreground">importadores frecuentes</strong>, <strong className="text-foreground">tiendas online</strong>,
          <strong className="text-foreground"> emprendedores</strong> que compran inventario en plataformas como Alibaba, 1688,
          Taobao o Shein, y <strong className="text-foreground">familias</strong> que reciben encomiendas personales. También
          ofrecemos un programa de referidos que recompensa a quienes traen nuevos clientes a la
          comunidad TLEC.
        </p>
        <p>
          La plataforma es construida y operada por el equipo de <strong className="text-foreground">IMPORTACIONES TLEC CARGO</strong>, una
          empresa con experiencia comprobada en logística entre Asia y Latinoamérica. Nuestro
          compromiso es ofrecer tarifas justas, soporte cercano por WhatsApp y tickets, y
          tecnología que elimine la incertidumbre típica del envío internacional.
        </p>
      </section>

      <section className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {HIGHLIGHTS.map((item) => (
          <Card key={item.title}>
            <CardContent className="flex items-start gap-4 p-5">
              <div className="rounded-xl bg-accent p-3 text-accent-foreground">
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-12 flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link to={createPageUrl('Contact')}>Contáctanos</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to={createPageUrl('Rates')}>Ver tarifas</Link>
        </Button>
      </section>
    </PublicPageShell>
  );
}