import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Truck, UserCheck, Route, Package, History } from 'lucide-react';
import EstadoLogisticaBadge from '@/components/logistica/EstadoLogisticaBadge';

const quickLinks = [
  { label: 'Vehículos', href: '/AdminVehiculos', icon: Truck },
  { label: 'Choferes', href: '/AdminChoferes', icon: UserCheck },
  { label: 'Rutas', href: '/AdminRutas', icon: Route },
  { label: 'Cargas', href: '/AdminCargaRutas', icon: Package },
  { label: 'Seguimiento', href: '/AdminSeguimientoRutas', icon: History },
];

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es-VE');
};

export default function AdminLogistica() {
  const [loading, setLoading] = useState(true);
  const [vehiculos, setVehiculos] = useState([]);
  const [choferes, setChoferes] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [cargas, setCargas] = useState([]);
  const [seguimientos, setSeguimientos] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [vehiculosRows, choferesRows, rutasRows, cargasRows, seguimientosRows] = await Promise.all([
        base44.entities.Vehiculo.list('-updated_date', 200),
        base44.entities.Chofer.list('-updated_date', 200),
        base44.entities.Ruta.list('-updated_date', 200),
        base44.entities.CargaRuta.list('-updated_date', 200),
        base44.entities.SeguimientoRuta.list('-fecha_hora', 200),
      ]);
      setVehiculos(vehiculosRows || []);
      setChoferes(choferesRows || []);
      setRutas(rutasRows || []);
      setCargas(cargasRows || []);
      setSeguimientos(seguimientosRows || []);
      setLoading(false);
    };

    loadData();
  }, []);

  const rutasById = useMemo(() => Object.fromEntries(rutas.map((item) => [item.id, item])), [rutas]);

  const metrics = useMemo(() => ({
    vehiculosDisponibles: vehiculos.filter((item) => item.estado === 'disponible').length,
    choferesDisponibles: choferes.filter((item) => item.estado === 'disponible').length,
    rutasActivas: rutas.filter((item) => ['asignada', 'en_curso'].includes(item.estado)).length,
    entregasPendientes: cargas.filter((item) => ['pendiente', 'en_transito', 'entrega_parcial'].includes(item.estado_entrega)).length,
  }), [vehiculos, choferes, rutas, cargas]);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-xl md:p-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-blue-100">
            <Truck className="h-3.5 w-3.5" />
            Centro de control logístico
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Logística</h1>
          <p className="max-w-2xl text-sm text-slate-200 md:text-base">
            Gestiona vehículos, choferes, rutas, carga y seguimiento desde un solo panel.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Vehículos disponibles</p><p className="mt-2 text-3xl font-bold text-slate-900">{metrics.vehiculosDisponibles}</p></CardContent></Card>
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Choferes disponibles</p><p className="mt-2 text-3xl font-bold text-slate-900">{metrics.choferesDisponibles}</p></CardContent></Card>
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Rutas activas</p><p className="mt-2 text-3xl font-bold text-slate-900">{metrics.rutasActivas}</p></CardContent></Card>
        <Card className="border-0 shadow-lg"><CardContent className="p-5"><p className="text-sm text-slate-500">Entregas pendientes</p><p className="mt-2 text-3xl font-bold text-slate-900">{metrics.entregasPendientes}</p></CardContent></Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Accesos rápidos</CardTitle>
          <CardDescription>Entra directo a cada área del módulo.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Button key={item.href} variant="outline" className="h-auto justify-start gap-3 p-4" onClick={() => window.location.href = item.href}>
                <div className="rounded-xl bg-slate-100 p-2">
                  <Icon className="h-4 w-4 text-slate-700" />
                </div>
                <span>{item.label}</span>
              </Button>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Rutas recientes</CardTitle>
            <CardDescription>Últimos movimientos operativos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {rutas.slice(0, 5).map((ruta) => (
              <div key={ruta.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">{ruta.codigo_ruta}</p>
                    <p className="text-sm text-slate-500">{ruta.origen} → {ruta.destino}</p>
                    <p className="text-xs text-slate-400 mt-1">Salida: {formatDate(ruta.fecha_salida)}</p>
                  </div>
                  <EstadoLogisticaBadge value={ruta.estado} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.location.href = `/AdminCargaRutas?ruta_id=${ruta.id}`}>
                    Ver cargas
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.location.href = `/AdminSeguimientoRutas?ruta_id=${ruta.id}`}>
                    Ver seguimiento
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Seguimientos recientes</CardTitle>
            <CardDescription>Eventos registrados más recientes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {seguimientos.slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">{rutasById[item.ruta_id]?.codigo_ruta || 'Ruta sin código'}</p>
                    <p className="text-sm text-slate-500">{item.ubicacion || 'Sin ubicación'}</p>
                    <p className="text-xs text-slate-400 mt-1">{formatDate(item.fecha_hora)}</p>
                  </div>
                  <EstadoLogisticaBadge value={item.estado} />
                </div>
                <p className="mt-3 text-sm text-slate-600">{item.comentario || 'Sin comentario'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.location.href = `/AdminSeguimientoRutas?ruta_id=${item.ruta_id}${item.carga_ruta_id ? `&carga_id=${item.carga_ruta_id}` : ''}`}>
                    Abrir seguimiento
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}