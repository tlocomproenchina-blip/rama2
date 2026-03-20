import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import useAdminSeguimientoData from '@/hooks/useAdminSeguimientoData';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, History, Truck, Package, MapPin } from 'lucide-react';
import EstadoLogisticaBadge from '@/components/logistica/EstadoLogisticaBadge';
import PageHero from '@/components/common/PageHero';

const quickLinks = [
  { label: 'Seguimiento de Rutas', href: '/AdminSeguimientoRutas', icon: History },
  { label: 'Tracking General', href: '/ShipmentTracking', icon: Truck },
  { label: 'Rutas', href: '/AdminRutas', icon: Truck },
  { label: 'Logística', href: '/AdminLogistica', icon: Package },
];

const formatDate = (value) => value ? new Date(value).toLocaleString('es-VE') : '—';

export default function AdminSeguimiento() {
  const { data, loading } = useAdminSeguimientoData();
  const packages = data?.packages || [];
  const routes = data?.routes || [];
  const trackingEvents = data?.trackingEvents || [];

  const routeById = useMemo(() => Object.fromEntries(routes.map((item) => [item.id, item])), [routes]);

  const metrics = useMemo(() => ({
    rutasActivas: routes.filter((item) => ['asignada', 'en_curso'].includes(item.estado)).length,
    paquetesEnTransito: packages.filter((item) => item.status === 'en_transito').length,
    paquetesDisponibles: packages.filter((item) => item.status === 'disponible').length,
    eventosRecientes: trackingEvents.length,
  }), [packages, routes, trackingEvents]);

  const latestByRoute = useMemo(() => trackingEvents.reduce((acc, item) => {
    if (!item.ruta_id) return acc;
    if (!acc[item.ruta_id]) acc[item.ruta_id] = item;
    return acc;
  }, {}), [trackingEvents]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHero
        icon={History}
        badge="Centro de seguimiento"
        title="Seguimiento"
        description="Monitorea rutas activas, paquetes en tránsito y eventos recientes de entrega."
        loadingLabel={loading ? 'Actualizando datos' : ''}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Rutas activas</p><p className="mt-2 text-3xl font-bold text-slate-900">{metrics.rutasActivas}</p></CardContent></Card>
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Paquetes en tránsito</p><p className="mt-2 text-3xl font-bold text-slate-900">{metrics.paquetesEnTransito}</p></CardContent></Card>
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Paquetes disponibles</p><p className="mt-2 text-3xl font-bold text-slate-900">{metrics.paquetesDisponibles}</p></CardContent></Card>
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Eventos registrados</p><p className="mt-2 text-3xl font-bold text-slate-900">{metrics.eventosRecientes}</p></CardContent></Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Accesos rápidos</CardTitle>
          <CardDescription>Entra directo a las herramientas de seguimiento.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Button key={item.href} variant="outline" className="h-auto justify-start gap-3 p-4" asChild>
                <Link to={item.href}>
                  <div className="rounded-xl bg-slate-100 p-2">
                    <Icon className="h-4 w-4 text-slate-700" />
                  </div>
                  <span>{item.label}</span>
                </Link>
              </Button>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Rutas con último avance</CardTitle>
            <CardDescription>Vista rápida del estado más reciente por ruta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {routes.slice(0, 6).map((route) => (
              <div key={route.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">{route.codigo_ruta}</p>
                    <p className="text-sm text-slate-500">{route.origen} → {route.destino}</p>
                    <p className="text-xs text-slate-400 mt-1">Último avance: {latestByRoute[route.id]?.estado ? String(latestByRoute[route.id].estado).replaceAll('_', ' ') : 'Sin registros'}</p>
                    <p className="text-xs text-slate-400 mt-1">Ubicación: {latestByRoute[route.id]?.ubicacion || '—'}</p>
                  </div>
                  <EstadoLogisticaBadge value={route.estado} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.location.href = `/AdminRutaDetalle?ruta_id=${route.id}`}>
                    Ver detalle
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.location.href = `/AdminSeguimientoRutas?ruta_id=${route.id}&action=new`}>
                    Registrar avance
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Eventos recientes</CardTitle>
            <CardDescription>Últimos movimientos registrados en ruta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {trackingEvents.slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">{routeById[item.ruta_id]?.codigo_ruta || 'Ruta sin código'}</p>
                    <p className="text-sm text-slate-500 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {item.ubicacion || 'Sin ubicación'}</p>
                    <p className="text-xs text-slate-400 mt-1">{formatDate(item.fecha_hora)}</p>
                    <p className="text-sm text-slate-600 mt-2">{item.comentario || 'Sin comentario'}</p>
                  </div>
                  <EstadoLogisticaBadge value={item.estado} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}