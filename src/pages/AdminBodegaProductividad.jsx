import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { BarChart3, ScanLine, PackageCheck, UserX, Copy, TrendingDown, Loader2, Smartphone, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
}

export default function AdminBodegaProductividad({ user }) {
  const [scans, setScans] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      // Traer escaneos recientes (hoy) y dispositivos en paralelo
      const todayStart = startOfToday().toISOString();
      const [recentScans, deviceList] = await Promise.all([
        base44.entities.EscaneoBodega.filter(
          { created_date: { $gte: todayStart } }, '-created_date', 1000
        ).catch(() => []),
        base44.entities.DispositivoBodega.list('-last_activity', 100).catch(() => []),
      ]);
      setScans(recentScans || []);
      setDevices(deviceList || []);
      setLastRefresh(new Date());
    } catch (err) {
      toast.error('Error al cargar productividad');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  const todayScans = scans;
  const totalToday = todayScans.length;
  const recibidos = todayScans.filter(s => s.result_type === 'recibido').length;
  const huerfanos = todayScans.filter(s => s.result_type === 'huerfano').length;
  const duplicados = todayScans.filter(s => s.result_type === 'duplicado').length;
  const orphanRate = totalToday > 0 ? ((huerfanos / totalToday) * 100).toFixed(1) : '0.0';

  // Breakdown por dispositivo
  const byDevice = {};
  todayScans.forEach(s => {
    if (!byDevice[s.device_id]) {
      byDevice[s.device_id] = { total: 0, recibido: 0, huerfano: 0, duplicado: 0 };
    }
    byDevice[s.device_id].total++;
    if (s.result_type) byDevice[s.device_id][s.result_type]++;
  });

  const deviceRows = Object.entries(byDevice)
    .map(([deviceId, counts]) => {
      const dev = devices.find(d => d.device_id === deviceId);
      return {
        deviceId,
        alias: dev?.alias || `Dispositivo ${deviceId.slice(0, 8).toUpperCase()}`,
        ...counts,
      };
    })
    .sort((a, b) => b.total - a.total);

  // Últimos 15 escaneos
  const recent = todayScans.slice(0, 15);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-slate-800">Productividad Bodega China</h1>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
        <p className="text-sm text-slate-500">
          Resumen de escaneos del día · {new Date().toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}
          {lastRefresh && <span className="text-xs text-slate-400 ml-2">· Actualizado: {fmtTime(lastRefresh)}</span>}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-card rounded-xl border p-4 shadow-card">
          <div className="flex items-center gap-2 text-primary text-xs mb-1">
            <ScanLine className="h-3.5 w-3.5" /> Total hoy
          </div>
          <p className="text-3xl font-bold text-slate-800">{totalToday}</p>
        </div>
        <div className="bg-card rounded-xl border p-4 shadow-card">
          <div className="flex items-center gap-2 text-green-600 text-xs mb-1">
            <PackageCheck className="h-3.5 w-3.5" /> Recibidos
          </div>
          <p className="text-3xl font-bold text-green-600">{recibidos}</p>
        </div>
        <div className="bg-card rounded-xl border p-4 shadow-card">
          <div className="flex items-center gap-2 text-red-600 text-xs mb-1">
            <UserX className="h-3.5 w-3.5" /> Huérfanos
          </div>
          <p className="text-3xl font-bold text-red-600">{huerfanos}</p>
        </div>
        <div className="bg-card rounded-xl border p-4 shadow-card">
          <div className="flex items-center gap-2 text-yellow-600 text-xs mb-1">
            <Copy className="h-3.5 w-3.5" /> Duplicados
          </div>
          <p className="text-3xl font-bold text-yellow-600">{duplicados}</p>
        </div>
        <div className="bg-card rounded-xl border p-4 shadow-card">
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
            <TrendingDown className="h-3.5 w-3.5" /> Tasa huérfanos
          </div>
          <p className="text-3xl font-bold text-slate-700">{orphanRate}%</p>
        </div>
      </div>

      {/* Breakdown por dispositivo */}
      <div className="bg-card rounded-xl border shadow-card overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-primary" />
            Productividad por dispositivo
          </h2>
        </div>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : deviceRows.length === 0 ? (
          <p className="text-center text-slate-400 py-8">Sin escaneos registrados hoy</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold">Dispositivo</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Total</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-green-600">Recibidos</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-red-600">Huérfanos</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-yellow-600">Duplicados</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Tasa huérf.</th>
                </tr>
              </thead>
              <tbody>
                {deviceRows.map((row) => {
                  const rate = row.total > 0 ? ((row.huerfano / row.total) * 100).toFixed(0) : '0';
                  return (
                    <tr key={row.deviceId} className="border-t hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-700 truncate max-w-[200px]">{row.alias}</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]">{row.deviceId}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-800">{row.total}</td>
                      <td className="px-4 py-2.5 text-right text-green-600 font-semibold">{row.recibido}</td>
                      <td className="px-4 py-2.5 text-right text-red-600 font-semibold">{row.huerfano}</td>
                      <td className="px-4 py-2.5 text-right text-yellow-600 font-semibold">{row.duplicado}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Badge variant={Number(rate) > 20 ? 'destructive' : 'secondary'} className="text-xs">
                          {rate}%
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Últimos escaneos */}
      <div className="bg-card rounded-xl border shadow-card overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-primary" />
            Últimos escaneos del día
          </h2>
        </div>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : recent.length === 0 ? (
          <p className="text-center text-slate-400 py-8">Sin escaneos hoy</p>
        ) : (
          <div className="divide-y">
            {recent.map((scan) => (
              <div key={scan.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                <Badge variant={
                  scan.result_type === 'recibido' ? 'secondary' :
                  scan.result_type === 'duplicado' ? 'outline' : 'destructive'
                } className="text-[10px] min-w-[70px] justify-center">
                  {scan.result_type}
                </Badge>
                {scan.shipping_mark && (
                  <span className="text-xs font-mono font-semibold text-slate-700 truncate max-w-[120px]">
                    {scan.shipping_mark}
                  </span>
                )}
                <span className="text-xs text-slate-500 truncate flex-1">{scan.tracking_number || 'Sin tracking'}</span>
                <span className="text-xs text-slate-400 shrink-0">{fmtTime(scan.created_date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}