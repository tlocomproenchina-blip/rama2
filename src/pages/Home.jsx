import React from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Ship, Plane, Package, ShieldCheck, Clock, MapPin, ArrowRight, Loader2 } from 'lucide-react';

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
      <section className="relative overflow-hidden rounded-2xl border bg-white p-8 md:p-12">
        <img aria-hidden="true" src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/695da428c9924ef9b68e8866/460a4f069_ChatGPTImage6mar202617_06_35.png" alt="" className="absolute inset-0 h-full w-full object-cover blur-md md:blur-lg opacity-40 md:opacity-50 scale-105 pointer-events-none select-none z-0" />
        <div className="relative z-10 max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">Logística China → Venezuela, sin fricción</h1>
          <p className="mt-4 text-lg text-slate-600">Consolidamos, aseguramos y entregamos puerta a puerta. Transparente, rápido y con soporte en español.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to={createPageUrl('ShippingCalculator')}><Button className="bg-blue-600 hover:bg-blue-700">Calcular tarifas <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
            <Button
              variant="outline"
              onClick={handleAuthClick}
              disabled={authLoading}
              className="transition-transform hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">

              Registrarse
            </Button>
            <Button
              variant="secondary"
              onClick={handleAuthClick}
              disabled={authLoading}
              className="gap-2 transition-transform hover:scale-[1.03] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">

              {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Iniciar sesión
            </Button>
            <Link to={createPageUrl('Blog')}><Button variant="ghost">Ver blog</Button></Link>
          </div>
        </div>
      </section>

      {/* Beneficios */}
      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {[{ icon: Ship, title: 'Marítimo y Aéreo', desc: 'Rutas optimizadas desde puertos y aeropuertos clave en China.' }, { icon: Package, title: 'Consolidación inteligente', desc: 'Ahorra con consolidación y embalaje seguro.' }, { icon: ShieldCheck, title: 'Seguro y trazabilidad', desc: 'Cobertura y tracking en cada hito.' }].map((b, i) =>
        <Card key={i}>
            <CardHeader className="flex flex-row items-center gap-3">
              <b.icon className="h-6 w-6 text-blue-600" />
              <CardTitle className="text-lg">{b.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-slate-600">{b.desc}</CardContent>
          </Card>
        )}
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

      {/* Servicios */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold mb-4">Servicios</h2>
        <div className="grid gap-4 md:grid-cols-4">
          {[{ icon: Ship, title: 'Marítimo (FCL/LCL)', desc: 'Optimización por CBM y salidas regulares.' }, { icon: Plane, title: 'Aéreo', desc: 'Para cargas urgentes y sensibles.' }, { icon: ShieldCheck, title: 'Seguro', desc: 'Cobertura para tu mercancía.' }, { icon: Package, title: 'Puerta a puerta', desc: 'Entrega final en tu destino.' }].map((s, i) =>
          <Card key={i}>
              <CardHeader className="flex flex-row items-center gap-3">
                <s.icon className="h-6 w-6 text-blue-600" />
                <CardTitle className="text-lg">{s.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-slate-600">{s.desc}</CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Tarifas */}
      <section className="mt-12 rounded-2xl border bg-white p-6 md:p-8">
        <h2 className="text-2xl font-bold mb-2">Tarifas transparentes</h2>
        <p className="text-slate-600">Calcula tu envío en minutos y compara marítimo vs aéreo según tiempos y presupuesto.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-[300px_auto] items-start">
          <div>
            <Select value={selectedCode} onValueChange={setSelectedCode}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona tu estado" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {states.map((s) =>
                <SelectItem key={s.id} value={s.state_code}>{s.state_name}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to={createPageUrl('ShippingCalculator')}><Button className="bg-blue-600 hover:bg-blue-700">Calcular ahora</Button></Link>
            <Link to={createPageUrl('Rates')}><Button variant="outline">Ver tarifas y condiciones</Button></Link>
          </div>
        </div>

        {selectedCode && (() => {
          const s = states.find((x) => x.state_code === selectedCode);
          const reg = s?.final_rate_regular;
          const high = s?.final_rate_high;
          return (
            <div className="mt-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="uppercase text-xs/5 tracking-wider opacity-80">Tarifa final por unidad</div>
                  <div className="text-2xl font-bold">{s?.state_name || selectedCode}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-3xl font-extrabold">
                    {reg && reg > 0 ? `$${Number(reg).toLocaleString('en-US')}` : 'Consultar'}
                    <span className="text-sm font-medium ml-2 opacity-90">regular</span>
                  </div>
                  {high && high > 0 &&
                  <div className="text-sm bg-white/15 px-3 py-1 rounded-full">
                      Alto riesgo: <b>${Number(high).toLocaleString('en-US')}</b>
                    </div>
                  }
                </div>
              </div>
              <div className="mt-2 text-white/90 text-sm">Tiempo estimado marítimo: 90 días</div>
            </div>);

        })()}
      </section>

      {/* Testimonios */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold mb-4">Testimonios</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {[{ q: 'Excelente manejo de consolidaciones, ahorré en CBM y llegó antes de lo previsto.', a: 'Carlos R.' }, { q: 'Atención clara y soporte por WhatsApp en todo momento.', a: 'Mariana P.' }].map((t, i) =>
          <Card key={i}>
              <CardContent className="pt-6">
                <p className="text-slate-800">“{t.q}”</p>
                <p className="mt-3 text-sm text-slate-500">— {t.a}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-12 rounded-2xl border bg-white p-6 md:p-8">
        <h2 className="text-2xl font-bold mb-4">Preguntas frecuentes</h2>
        <div className="space-y-4">
          <div>
            <div className="font-medium">¿Cuánto tarda el envío marítimo vs aéreo?</div>
            <p className="text-slate-600">Marítimo suele tardar más pero reduce costo/CBM; aéreo es más rápido para cargas urgentes.</p>
          </div>
          <div>
            <div className="font-medium">¿Puedo consolidar paquetes de diferentes proveedores?</div>
            <p className="text-slate-600">Sí, consolidamos en nuestro almacén de China para optimizar volumen y seguridad.</p>
          </div>
          <div>
            <div className="font-medium">¿Qué documentación necesito?</div>
            <p className="text-slate-600">Factura/comercial y datos del destinatario; te asesoramos en requisitos aduaneros.</p>
          </div>
        </div>
        <div className="mt-4">
          <Link to={createPageUrl('FAQ')}><Button variant="ghost">Ver más preguntas</Button></Link>
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
    </div>);

}