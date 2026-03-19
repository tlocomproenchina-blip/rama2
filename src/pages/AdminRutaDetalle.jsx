import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Package, History } from 'lucide-react';
import RutaDetalleResumen from '@/components/logistica/RutaDetalleResumen';
import RutaDetalleCargasList from '@/components/logistica/RutaDetalleCargasList';
import RutaDetalleSeguimientoList from '@/components/logistica/RutaDetalleSeguimientoList';
import RouteOptimizationCard from '@/components/logistica/RouteOptimizationCard';

export default function AdminRutaDetalle() {
  const urlParams = new URLSearchParams(window.location.search);
  const rutaId = urlParams.get('ruta_id') || '';
  const [loading, setLoading] = useState(true);
  const [ruta, setRuta] = useState(null);
  const [cargas, setCargas] = useState([]);
  const [seguimientos, setSeguimientos] = useState([]);
  const [optimizationPlan, setOptimizationPlan] = useState(null);
  const [optimizing, setOptimizing] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!rutaId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const [rutasRows, cargasRows, seguimientoRows, planRows] = await Promise.all([
        base44.entities.Ruta.filter({ id: rutaId }, '-updated_date', 1),
        base44.entities.CargaRuta.filter({ ruta_id: rutaId }, '-updated_date', 200),
        base44.entities.SeguimientoRuta.filter({ ruta_id: rutaId }, '-fecha_hora', 200),
        base44.entities.RouteOptimizationPlan.filter({ route_id: rutaId }, '-updated_date', 1),
      ]);
      setRuta(rutasRows?.[0] || null);
      setCargas(cargasRows || []);
      setSeguimientos(seguimientoRows || []);
      setOptimizationPlan(planRows?.[0] || null);
      setLoading(false);
    };

    loadData();
  }, [rutaId]);

  const metrics = useMemo(() => ({
    totalCargas: cargas.length,
    pendientes: cargas.filter((item) => ['pendiente', 'en_transito', 'entrega_parcial'].includes(item.estado_entrega)).length,
    completadas: cargas.filter((item) => item.estado_entrega === 'entregada').length,
  }), [cargas]);

  const loadData = async () => {
    if (!rutaId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const [rutasRows, cargasRows, seguimientoRows, planRows] = await Promise.all([
      base44.entities.Ruta.filter({ id: rutaId }, '-updated_date', 1),
      base44.entities.CargaRuta.filter({ ruta_id: rutaId }, '-updated_date', 200),
      base44.entities.SeguimientoRuta.filter({ ruta_id: rutaId }, '-fecha_hora', 200),
      base44.entities.RouteOptimizationPlan.filter({ route_id: rutaId }, '-updated_date', 1),
    ]);
    setRuta(rutasRows?.[0] || null);
    setCargas(cargasRows || []);
    setSeguimientos(seguimientoRows || []);
    setOptimizationPlan(planRows?.[0] || null);
    setLoading(false);
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    await base44.functions.invoke('optimizeRouteSequence', { routeId: rutaId, mode: 'manual' });
    await loadData();
    setOptimizing(false);
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  if (!ruta) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Button variant="outline" onClick={() => window.location.href = '/AdminRutas'}>
          <ArrowLeft className="h-4 w-4" /> Volver a rutas
        </Button>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-sm text-slate-500">No se encontró la ruta solicitada.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => window.location.href = '/AdminRutas'}>
          <ArrowLeft className="h-4 w-4" /> Volver a rutas
        </Button>
        <Button variant="outline" onClick={() => window.location.href = `/AdminCargaRutas?ruta_id=${ruta.id}&action=new`}>
          <Package className="h-4 w-4" /> Nueva carga
        </Button>
        <Button variant="outline" onClick={() => window.location.href = `/AdminSeguimientoRutas?ruta_id=${ruta.id}&action=new`}>
          <History className="h-4 w-4" /> Registrar avance
        </Button>
      </div>

      <RutaDetalleResumen ruta={ruta} metrics={metrics} ultimoSeguimiento={seguimientos[0]} />

      <div className="grid gap-6 xl:grid-cols-2">
        <RutaDetalleCargasList cargas={cargas} />
        <RutaDetalleSeguimientoList seguimientos={seguimientos.slice(0, 10)} />
      </div>
    </div>
  );
}