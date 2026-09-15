import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Smartphone, Activity, ScanLine, Clock, AlertTriangle, Loader2, Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ImageViewerModal from '@/components/common/ImageViewerModal';
import { toast } from 'sonner';

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days}d`;
}

function isStale(dateStr) {
  if (!dateStr) return true;
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff > 24 * 60 * 60 * 1000; // 24h
}

export default function AdminDispositivosBodega({ user }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [scans, setScans] = useState([]);
  const [loadingScans, setLoadingScans] = useState(false);
  const [editingAlias, setEditingAlias] = useState(null);
  const [aliasValue, setAliasValue] = useState('');
  const [viewerImage, setViewerImage] = useState(null);

  const loadDevices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await base44.entities.DispositivoBodega.list('-last_activity', 100);
      setDevices(res || []);
    } catch (err) {
      toast.error('Error al cargar dispositivos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  // Refresh every 30s
  useEffect(() => {
    const interval = setInterval(loadDevices, 30000);
    return () => clearInterval(interval);
  }, [loadDevices]);

  const openDeviceLog = useCallback(async (device) => {
    setSelectedDevice(device);
    setLoadingScans(true);
    try {
      const res = await base44.entities.EscaneoBodega.filter(
        { device_id: device.device_id }, '-created_date', 50
      );
      setScans(res || []);
    } catch (err) {
      setScans([]);
    } finally {
      setLoadingScans(false);
    }
  }, []);

  const saveAlias = useCallback(async (deviceId) => {
    try {
      const device = devices.find(d => d.device_id === deviceId);
      if (!device) return;
      await base44.entities.DispositivoBodega.update(device.id, { alias: aliasValue.trim() || device.alias });
      toast.success('Alias actualizado');
      setEditingAlias(null);
      loadDevices();
    } catch (err) {
      toast.error('Error al actualizar alias');
    }
  }, [devices, aliasValue, loadDevices]);

  const activeCount = devices.filter(d => !isStale(d.last_activity)).length;
  const staleCount = devices.length - activeCount;
  const totalScansToday = devices.filter(d => {
    if (!d.last_activity) return false;
    const today = new Date().toDateString();
    return new Date(d.last_activity).toDateString() === today;
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Smartphone className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-slate-800">Dispositivos Bodega China</h1>
        </div>
        <p className="text-sm text-slate-500">
          Monitoreo de dispositivos de escaneo en la bodega de China · Ruta de acceso: <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">/BodegaScan</code>
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border p-4 shadow-card">
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
            <Smartphone className="h-3.5 w-3.5" /> Total
          </div>
          <p className="text-2xl font-bold text-slate-800">{devices.length}</p>
        </div>
        <div className="bg-card rounded-xl border p-4 shadow-card">
          <div className="flex items-center gap-2 text-green-600 text-xs mb-1">
            <Activity className="h-3.5 w-3.5" /> Activos (24h)
          </div>
          <p className="text-2xl font-bold text-green-600">{activeCount}</p>
        </div>
        <div className="bg-card rounded-xl border p-4 shadow-card">
          <div className="flex items-center gap-2 text-yellow-600 text-xs mb-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Inactivos
          </div>
          <p className="text-2xl font-bold text-yellow-600">{staleCount}</p>
        </div>
        <div className="bg-card rounded-xl border p-4 shadow-card">
          <div className="flex items-center gap-2 text-primary text-xs mb-1">
            <ScanLine className="h-3.5 w-3.5" /> Activos hoy
          </div>
          <p className="text-2xl font-bold text-primary">{totalScansToday}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : devices.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Smartphone className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No hay dispositivos registrados aún.</p>
          <p className="text-xs mt-1">Los dispositivos aparecen automáticamente al abrir /BodegaScan</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {devices.map((device) => {
            const stale = isStale(device.last_activity);
            return (
              <div
                key={device.id}
                className={`bg-card rounded-xl border p-4 shadow-card cursor-pointer hover:shadow-premium transition-shadow ${stale ? 'border-yellow-300' : 'border-green-300'}`}
                onClick={() => openDeviceLog(device)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    {editingAlias === device.device_id ? (
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <Input
                          value={aliasValue}
                          onChange={e => setAliasValue(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveAlias(device.device_id)}
                          className="h-8 text-sm"
                          autoFocus
                        />
                        <Button size="sm" onClick={() => saveAlias(device.device_id)}>OK</Button>
                      </div>
                    ) : (
                      <h3
                        className="font-semibold text-slate-800 truncate hover:text-primary"
                        onClick={e => { e.stopPropagation(); setEditingAlias(device.device_id); setAliasValue(device.alias || ''); }}
                        title="Click para editar alias"
                      >
                        {device.alias || `Dispositivo ${device.device_id.slice(0, 8).toUpperCase()}`}
                      </h3>
                    )}
                    <p className="text-[10px] text-slate-400 font-mono truncate">{device.device_id}</p>
                  </div>
                  <Badge variant={stale ? 'destructive' : 'secondary'} className="shrink-0">
                    {stale ? 'Inactivo' : 'Activo'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <ScanLine className="h-3.5 w-3.5" />
                    <span className="font-semibold text-slate-700">{device.total_scans || 0}</span>
                    <span className="text-xs">escaneos</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-xs">{timeAgo(device.last_activity)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedDevice} onOpenChange={(open) => !open && setSelectedDevice(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-primary" />
              {selectedDevice?.alias || `Dispositivo ${selectedDevice?.device_id?.slice(0, 8).toUpperCase()}`}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {loadingScans ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : scans.length === 0 ? (
              <p className="text-center text-slate-400 py-8">Sin escaneos registrados</p>
            ) : (
              <div className="space-y-2">
                {scans.map((scan) => (
                  <div key={scan.id} className="flex items-center gap-3 bg-slate-50 rounded-lg p-2.5">
                    {scan.photo_url ? (
                      <img
                        src={scan.photo_url}
                        alt="paquete"
                        className="w-14 h-14 rounded-lg object-cover shrink-0 cursor-zoom-in hover:opacity-80 transition-opacity"
                        onClick={() => setViewerImage({ url: scan.photo_url, title: `Escaneo ${scan.tracking_number || ''}` })}
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
                        <Camera className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          scan.result_type === 'recibido' ? 'secondary' :
                          scan.result_type === 'duplicado' ? 'outline' : 'destructive'
                        } className="text-[10px]">
                          {scan.result_type}
                        </Badge>
                        {scan.shipping_mark && (
                          <span className="text-xs font-mono font-semibold text-slate-700 truncate">
                            {scan.shipping_mark}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{scan.tracking_number}</p>
                      <p className="text-[10px] text-slate-400">{timeAgo(scan.created_date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ImageViewerModal
        open={!!viewerImage}
        imageUrl={viewerImage?.url}
        onClose={() => setViewerImage(null)}
        title={viewerImage?.title || 'Imagen'}
      />
    </div>
  );
}