import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Ship, Plane, Package, ShieldCheck, Clock, MapPin, ArrowRight } from 'lucide-react';

export default function Home({ user }) {
  // Si hay sesión, mantenemos el acceso a los paneles
  React.useEffect(() => {
    if (!user) {
      document.title = 'Envíos China → Venezuela | TLEC Logistics';
      const meta = document.querySelector('meta[name="description"]') || document.createElement('meta');
      meta.name = 'description';
      meta.content = 'Transporte puerta a puerta desde China a Venezuela: consolidación, tarifas claras y soporte experto.';
      document.head.appendChild(meta);
    }
  }, [user]);

  if (user) {
    return (
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Bienvenido</h1>
        <p className="text-slate-600">Accede al panel desde el menú lateral.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border bg-white p-8 md:p-12">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">Logística China → Venezuela, sin fricción</h1>
          <p className="mt-4 text-lg text-slate-600">Consolidamos, aseguramos y entregamos puerta a puerta. Transparente, rápido y con soporte en español.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to={createPageUrl('ShippingCalculator')}><Button className="bg-blue-600 hover:bg-blue-700">Calcular tarifas <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
            <Link to={createPageUrl('PreAlert')}><Button variant="outline">Crear pre‑alerta</Button></Link>
            <Link to={createPageUrl('Blog')}><Button variant="ghost">Ver blog</Button></Link>
          </div>
        </div>
        <img src="https://images.unsplash.com/photo-1541462608143-67571c6738dd?q=80&w=1600&auto=format&fit=crop" alt="Carga marítima" className="absolute right-0 top-0 h-full w-[55%] object-cover hidden md:block rounded-l-2xl" />
      </section>

      {/* Beneficios */}
      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {[{icon: Ship, title: 'Marítimo y Aéreo', desc: 'Rutas optimizadas desde puertos y aeropuertos clave en China.'}, {icon: Package, title: 'Consolidación inteligente', desc: 'Ahorra con consolidación y embalaje seguro.'}, {icon: ShieldCheck, title: 'Seguro y trazabilidad', desc: 'Cobertura y tracking en cada hito.'}].map((b, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center gap-3">
              <b.icon className="h-6 w-6 text-blue-600" />
              <CardTitle className="text-lg">{b.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-600">{b.desc}</CardContent>
          </Card>
        ))}
      </section>

      {/* Proceso */}
      <section className="mt-12 rounded-2xl border bg-white p-6 md:p-8">
        <h2 className="text-2xl font-bold mb-4">Cómo funciona</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2 font-medium"><MapPin className="h-5 w-5 text-blue-600" /> Dirección en China</div>
            <p className="text-slate-600 mt-1">Recibe tus compras en nuestro almacén y reporta con pre‑alerta.</p>
          </div>
          <div>
            <div className="flex items-center gap-2 font-medium"><Package className="h-5 w-5 text-blue-600" /> Consolidación</div>
            <p className="text-slate-600 mt-1">Unimos paquetes, optimizamos volumen (CBM) y embalamos.</p>
          </div>
          <div>
            <div className="flex items-center gap-2 font-medium"><Clock className="h-5 w-5 text-blue-600" /> Envío y entrega</div>
            <p className="text-slate-600 mt-1">Marítimo o aéreo según tu prioridad de tiempo y costo.</p>
          </div>
        </div>
      </section>

      {/* Llamado */}
      <section className="mt-12 text-center rounded-2xl border bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
        <h3 className="text-xl md:text-2xl font-semibold">¿Listo para enviar desde China a Venezuela?</h3>
        <p className="text-slate-600 mt-2">Obtén una cotización hoy y recibe asesoría experta.</p>
        <div className="mt-4 flex justify-center gap-3">
          <Link to={createPageUrl('ShippingCalculator')}><Button className="bg-blue-600 hover:bg-blue-700">Solicitar cotización</Button></Link>
          <Link to={createPageUrl('Support')}><Button variant="outline">Hablar con soporte</Button></Link>
        </div>
      </section>
    </div>
  );
}