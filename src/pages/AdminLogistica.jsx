import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Truck, UserCheck, Route, Package, History, AlertTriangle, CheckCircle2 } from 'lucide-react';
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
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthCheck, setHealthCheck] = useState(null);
  const [latestHealthReport, setLatestHealthReport] = useState(null);
  const [vehiculos, setVehiculos] = useState([]);
  const [choferes, setChoferes] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [cargas, setCargas] = useState([]);
  const [seguimientos, setSeguimientos] = useState([]);

  const runHealthCheck = async () => {
    setHealthLoading(true);
    const response = await base44.functions.invoke('runLogisticsHealthCheck', {});
    setHealthCheck(response.data);
    setHealthLoading(false);
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [vehiculosRows, choferesRows, rutasRows, cargasRows, seguimientosRows, reportRows] = await Promise.all([
        base44.entities.Vehiculo.list('-updated_date', 200),
        base44.entities.Chofer.list('-updated_date', 200),
        base44.entities.Ruta.list('-updated_date', 200),
        base44.entities.CargaRuta.list('-updated_date', 200),
        base44.entities.SeguimientoRuta.list('-fecha_hora', 200),
        base44.entities.LogisticsHealthReport.list('-checked_at', 1),
      ]);
      setVehiculos(vehiculosRows || []);
      setChoferes(choferesRows || []);
      setRutas(rutasRows || []);
      setCargas(cargasRows || []);
      setSeguimientos(seguimientosRows || []);
      setLatestHealthReport(reportRows?.[0] || null);
      setLoading(false);
    };

    loadData();
    runHealthCheck();
  }, []);

  const rutasById = useMemo(() => Object.fromEntries(rutas.map((item) => [item.id, item])), [rutas]);

  const metrics = useMemo(() => ({
    vehiculosDisponibles: vehiculos.filter((item) => item.estado === 'disponible').length,
    choferesDisponibles: choferes.filter((item) => item.estado === 'disponible').length,
    rutasActivas: rutas.filter((item) => ['asignada', 'en_curso'].includes(item.estado)).length,
    entregasPendientes: cargas.filter((item) => ['pendiente', 'en_transito', 'entrega_parcial'].includes(item.estado_entrega)).length,
  }), [vehiculos, choferes, rutas, cargas]);

  const cargasPendientesPorRuta = useMemo(() => cargas.reduce((acc, item) => {
    if (!['pendiente', 'en_transito', 'entrega_parcial'].includes(item.estado_entrega)) return acc;
    acc[item.ruta_id] = (acc[item.ruta_id] || 0) + 1;
    return acc;
  }, {}), [cargas]);

  const entregasCompletadasPorRuta = useMemo(() => cargas.reduce((acc, item) => {
    if (item.estado_entrega === 'entregada') {
      acc[item.ruta_id] = (acc[item.ruta_id] || 0) + 1;
    }
    return acc;
  }, {}), [cargas]);

  const rutasConPendientes = useMemo(() => rutas
    .filter((ruta) => cargasPendientesPorRuta[ruta.id])
    .sort((a, b) => (cargasPendientesPorRuta[b.id] || 0) - (cargasPendientesPorRuta[a.id] || 0))
  , [cargasPendientesPorRuta, rutas]);

  const ultimoSeguimientoPorRuta = useMemo(() => seguimientos.reduce((acc, item) => {
    if (!item.ruta_id) return acc;
    if (!acc[item.ruta_id]) acc[item.ruta_id] = item;
    return acc;
  }, {}), [seguimientos]);

  const vehiculosById = useMemo(() => Object.fromEntries(vehiculos.map((item) => [item.id, item])), [vehiculos]);

  const cargaResumenPorRuta = useMemo(() => cargas.reduce((acc, item) => {
    const current = acc[item.ruta_id] || { peso: 0, volumen: 0 };
    acc[item.ruta_id] = {
      peso: current.peso + Number(item.peso_kg || 0),
      volumen: current.volumen + Number(item.volumen_m3 || 0),
    };
    return acc;
  }, {}), [cargas]);

  const rutasConSobrecarga = useMemo(() => rutas.filter((ruta) => {
    const vehiculo = vehiculosById[ruta.vehiculo_id];
    const resumen = cargaResumenPorRuta[ruta.id] || { peso: 0, volumen: 0 };
    const exceedsPeso = vehiculo?.capacidad_peso_kg && resumen.peso > vehiculo.capacidad_peso_kg;
    const exceedsVolumen = vehiculo?.capacidad_volumen_m3 && resumen.volumen > vehiculo.capacidad_volumen_m3;
    return exceedsPeso || exceedsVolumen;
  }), [cargaResumenPorRuta, rutas, vehiculosById]);

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

      {latestHealthReport && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Último monitoreo automático</CardTitle>
            <CardDescription>{latestHealthReport.summary_text}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4 text-sm text-slate-600">
            <div><span className="font-medium text-slate-800">Severidad:</span> {latestHealthReport.severity}</div>
            <div><span className="font-medium text-slate-800">Fecha:</span> {latestHealthReport.checked_at ? new Date(latestHealthReport.checked_at).toLocaleString('es-VE') : '—'}</div>
            <div><span className="font-medium text-slate-800">Conflictos:</span> {latestHealthReport.resource_conflicts || 0}</div>
            <div><span className="font-medium text-slate-800">Sobrecarga:</span> {latestHealthReport.capacity_alerts || 0}</div>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-lg">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Diagnóstico logístico</CardTitle>
            <CardDescription>Validación rápida de conflictos, paquetes duplicados y sobrecargas.</CardDescription>
          </div>
          <Button variant="outline" onClick={runHealthCheck} disabled={healthLoading}>
            {healthLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
            Ejecutar diagnóstico
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className={`rounded-2xl border p-4 ${healthCheck?.summary?.resource_conflicts ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}`}>
            <div className="flex items-center gap-2 text-sm font-medium">
              {healthCheck?.summary?.resource_conflicts ? <AlertTriangle className="h-4 w-4 text-rose-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              <span>Conflictos de recursos</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{healthCheck?.summary?.resource_conflicts || 0}</p>
          </div>
          <div className={`rounded-2xl border p-4 ${healthCheck?.summary?.duplicate_packages ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}`}>
            <div className="flex items-center gap-2 text-sm font-medium">
              {healthCheck?.summary?.duplicate_packages ? <AlertTriangle className="h-4 w-4 text-rose-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              <span>Paquetes duplicados</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{healthCheck?.summary?.duplicate_packages || 0}</p>
          </div>
          <div className={`rounded-2xl border p-4 ${healthCheck?.summary?.capacity_alerts ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}`}>
            <div className="flex items-center gap-2 text-sm font-medium">
              {healthCheck?.summary?.capacity_alerts ? <AlertTriangle className="h-4 w-4 text-rose-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              <span>Alertas de capacidad</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{healthCheck?.summary?.capacity_alerts || 0}</p>
          </div>
        </CardContent>
      </Card>

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

      <div className="grid gap-6 xl:grid-cols-3">
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
                    <p className="text-xs text-slate-400 mt-1">Chofer: {ruta.chofer_nombre || 'Sin asignar'}</p>
                    <p className="text-xs text-slate-400 mt-1">Vehículo: {ruta.vehiculo_placa || 'Sin asignar'}</p>
                    <p className="text-xs text-slate-400 mt-1">Pendientes: {cargasPendientesPorRuta[ruta.id] || 0} · Completadas: {entregasCompletadasPorRuta[ruta.id] || 0}</p>
                    <p className="text-xs text-slate-400 mt-1">Último avance: {ultimoSeguimientoPorRuta[ruta.id]?.estado ? String(ultimoSeguimientoPorRuta[ruta.id].estado).replaceAll('_', ' ') : 'Sin registros'}</p>
                    <p className="text-xs text-slate-400 mt-1">Última ubicación: {ultimoSeguimientoPorRuta[ruta.id]?.ubicacion || '—'}</p>
                    <p className="text-xs text-slate-400 mt-1">Último evento: {formatDate(ultimoSeguimientoPorRuta[ruta.id]?.fecha_hora)}</p>
                  </div>
                  <EstadoLogisticaBadge value={ruta.estado} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.location.href = `/AdminRutaDetalle?ruta_id=${ruta.id}`}>
                    Ver detalle
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.location.href = `/AdminCargaRutas?ruta_id=${ruta.id}`}>
                    Ver cargas
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.location.href = `/AdminCargaRutas?ruta_id=${ruta.id}&action=new`}>
                    Nueva carga
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.location.href = `/AdminSeguimientoRutas?ruta_id=${ruta.id}`}>
                    Ver seguimiento
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.location.href = `/AdminSeguimientoRutas?ruta_id=${ruta.id}&action=new`}>
                    Registrar avance
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

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Entregas pendientes por ruta</CardTitle>
            <CardDescription>Prioriza las rutas con más trabajo por completar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {rutasConPendientes.slice(0, 5).map((ruta) => (
              <div key={ruta.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">{ruta.codigo_ruta}</p>
                    <p className="text-sm text-slate-500">{ruta.origen} → {ruta.destino}</p>
                    <p className="text-xs text-slate-400 mt-1">Pendientes: {cargasPendientesPorRuta[ruta.id] || 0}</p>
                  </div>
                  <EstadoLogisticaBadge value={ruta.estado} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.location.href = `/AdminRutaDetalle?ruta_id=${ruta.id}`}>
                    Ver detalle
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.location.href = `/AdminCargaRutas?ruta_id=${ruta.id}`}>
                    Ver cargas
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.location.href = `/AdminSeguimientoRutas?ruta_id=${ruta.id}&action=new`}>
                    Registrar avance
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Alertas de capacidad</CardTitle>
          <CardDescription>Rutas cuya carga supera la capacidad del vehículo asignado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rutasConSobrecarga.length === 0 ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
              No hay rutas con sobrecarga en este momento.
            </div>
          ) : (
            rutasConSobrecarga.slice(0, 5).map((ruta) => {
              const vehiculo = vehiculosById[ruta.vehiculo_id];
              const resumen = cargaResumenPorRuta[ruta.id] || { peso: 0, volumen: 0 };
              return (
                <div key={ruta.id} className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-900">{ruta.codigo_ruta}</p>
                      <p className="text-sm text-slate-600">{ruta.origen} → {ruta.destino}</p>
                      <p className="text-xs text-rose-700 mt-1">Cargado: {resumen.peso} kg · {resumen.volumen} m³</p>
                      <p className="text-xs text-rose-700">Capacidad: {vehiculo?.capacidad_peso_kg || 0} kg · {vehiculo?.capacidad_volumen_m3 || 0} m³</p>
                    </div>
                    <EstadoLogisticaBadge value={ruta.estado} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.location.href = `/AdminRutas`}>
                      Revisar ruta
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.location.href = `/AdminCargaRutas?ruta_id=${ruta.id}`}>
                      Ver cargas
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}