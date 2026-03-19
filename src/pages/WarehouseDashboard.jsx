import React from 'react';
import useWarehouseDashboardData from '@/hooks/useWarehouseDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import WarehouseStatsCards from '@/components/warehouse/WarehouseStatsCards';
import useWarehouseAccess from '@/hooks/useWarehouseAccess';

export default function WarehouseDashboard({ user }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { allowed, loading: loadingAccess } = useWarehouseAccess(user, 'WarehouseDashboard');

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await base44.functions.invoke('getWarehouseStats', {});
      setStats(response?.data?.stats || null);
    } catch {
      toast.error('No se pudo cargar el dashboard de almacén');
    }
    setLoading(false);
  };

  useEffect(() => { loadStats(); }, []);

  if (loadingAccess) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  if (!allowed) {
    return <Card><CardContent className="p-8 text-center text-slate-500">No tienes acceso a este módulo.</CardContent></Card>;
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Dashboard de almacén</h1>
          <p className="text-slate-500">Vista rápida de ocupación, recepción y preparación.</p>
        </div>
        <Button variant="outline" onClick={loadStats}><RefreshCw className="h-4 w-4 mr-2" /> Actualizar</Button>
      </div>

      <WarehouseStatsCards stats={stats || {}} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader><CardTitle>Capacidad general</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <div className="flex justify-between text-slate-600"><span>Unidades</span><span>{stats?.capacity?.units?.current || 0} / {stats?.capacity?.units?.total || 0}</span></div>
              <div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.min(stats?.capacity?.units?.utilization_percent || 0, 100)}%` }} /></div>
            </div>
            <div>
              <div className="flex justify-between text-slate-600"><span>Peso</span><span>{stats?.capacity?.weight?.current || 0} / {stats?.capacity?.weight?.total || 0} kg</span></div>
              <div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-emerald-600" style={{ width: `${Math.min(stats?.capacity?.weight?.utilization_percent || 0, 100)}%` }} /></div>
            </div>
            <div>
              <div className="flex justify-between text-slate-600"><span>Volumen</span><span>{stats?.capacity?.volume?.current || 0} / {stats?.capacity?.volume?.total || 0} cbm</span></div>
              <div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-purple-600" style={{ width: `${Math.min(stats?.capacity?.volume?.utilization_percent || 0, 100)}%` }} /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader><CardTitle>Estado operativo</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-sm text-slate-500">Pendientes por recibir</p>
              <p className="text-3xl font-bold text-amber-700">{stats?.pending_reception || 0}</p>
            </div>
            <div className="rounded-xl bg-indigo-50 p-4">
              <p className="text-sm text-slate-500">Solicitudes aprobadas</p>
              <p className="text-3xl font-bold text-indigo-700">{stats?.approved_requests || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader><CardTitle>Resumen por almacén</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(stats?.warehouses || []).map((warehouse) => (
            <div key={warehouse.id} className="rounded-xl border p-4">
              <p className="font-semibold text-slate-800">{warehouse.name}</p>
              <p className="text-sm text-slate-500">{warehouse.city}, {warehouse.country}</p>
              <div className="mt-3 grid grid-cols-3 gap-3 text-sm text-slate-600">
                <div><p className="text-slate-400">Ubicaciones</p><p className="font-medium">{warehouse.locations}</p></div>
                <div><p className="text-slate-400">Ocupadas</p><p className="font-medium">{warehouse.occupied_locations}</p></div>
                <div><p className="text-slate-400">Paquetes</p><p className="font-medium">{warehouse.packages}</p></div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader><CardTitle>Resumen por zona</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(stats?.zones || []).map((zone) => (
            <div key={zone.zone} className="rounded-xl border p-4">
              <p className="font-semibold text-slate-800 capitalize">{String(zone.zone).replaceAll('_', ' ')}</p>
              <div className="mt-3 grid grid-cols-3 gap-3 text-sm text-slate-600">
                <div><p className="text-slate-400">Ubicaciones</p><p className="font-medium">{zone.locations}</p></div>
                <div><p className="text-slate-400">Ocupadas</p><p className="font-medium">{zone.occupied_locations}</p></div>
                <div><p className="text-slate-400">Paquetes</p><p className="font-medium">{zone.packages}</p></div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}