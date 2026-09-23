import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2, ScanLine, Boxes, AlertTriangle, CheckCircle2,
  CloudOff, Cloud, Package, PackagePlus, X, RefreshCw, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import BarcodeScannerModule from '@/components/warehouse/BarcodeScannerModule';
import BluetoothPrinter from '@/components/warehouse/BluetoothPrinter';
import useScannedPhotoUploader from '@/hooks/useScannedPhotoUploader';
import useWarehouseAccess from '@/hooks/useWarehouseAccess';
import OpenBultoCard from '@/components/warehouse/OpenBultoCard';
import OpenBultosChips from '@/components/warehouse/OpenBultosChips';
import BultoHistory from '@/components/warehouse/BultoHistory';
import ManualPackageAssign from '@/components/warehouse/ManualPackageAssign';
import { useOfflineScanQueue } from '@/hooks/useOfflineScanQueue';
import { History, ChevronDown, ChevronUp } from 'lucide-react';

// Página unificada: escanea tracking → marca recibido + crea orden de despacho
// + agrega el paquete al bulto abierto del cliente (uno por cliente en paralelo).
// Al cerrar un bulto se imprime la etiqueta térmica por Bluetooth.
// Funciona offline: los escaneos se encolan y se procesan en segundo plano.
export default function WarehouseScanPack({ user }) {
  const { allowed, loading: loadingAccess } = useWarehouseAccess(user, 'WarehouseScanPack');
  const [code, setCode] = useState('');
  const [openBultos, setOpenBultos] = useState([]);
  const [activeBultoId, setActiveBultoId] = useState(null);
  const [lastScan, setLastScan] = useState(null);
  const [closingBulto, setClosingBulto] = useState(null);
  const [loadingOpen, setLoadingOpen] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [manualAssign, setManualAssign] = useState(null);
  const openBultosRef = useRef([]);
  const { handlePhotoCaptured, waitForPhoto } = useScannedPhotoUploader();

  // Helper: actualiza la ref y el estado sincrónicamente
  const updateBultosState = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(openBultosRef.current) : updater;
    openBultosRef.current = next;
    setOpenBultos(next);
  }, []);

  // Cargar bultos abiertos al montar
  const loadOpenBultos = useCallback(async () => {
    setLoadingOpen(true);
    try {
      const bultos = await base44.entities.Bulto.filter({ status: 'activo' }, 'bulto_number', 500);
      updateBultosState(bultos || []);
      if (bultos?.length && !activeBultoId) setActiveBultoId(bultos[0].id);
    } catch (_) {
      toast.error('Error al cargar bultos abiertos');
    } finally {
      setLoadingOpen(false);
    }
  }, [activeBultoId, updateBultosState]);

  useEffect(() => {
    if (allowed) loadOpenBultos();
  }, [allowed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Callback cuando un escaneo se confirma en el servidor
  const handleConfirmed = useCallback((tempId, pkg, client, bultoData) => {
    setLastScan({ package: pkg, client, auto_received: false, bulto: bultoData });
    // Actualizar la lista de bultos abiertos
    if (bultoData?.id && bultoData.status === 'activo') {
      updateBultosState((prev) => {
        const exists = prev.find((b) => b.id === bultoData.id);
        if (exists) {
          return prev.map((b) => (b.id === bultoData.id ? bultoData : b));
        }
        return [...prev, bultoData];
      });
      setActiveBultoId(bultoData.id);
    }
    toast.success(`Paquete ${pkg.tracking_number} agregado al bulto`, { duration: 2000 });
  }, [updateBultosState]);

  // Callback cuando un escaneo no se encuentra
  const handleNotFound = useCallback((tempId, tracking) => {
    setManualAssign({ tracking, tempId });
  }, []);

  // Callback cuando se cierra un bulto en el servidor
  const handleClosed = useCallback(() => {
    setHistoryRefreshKey((k) => k + 1);
  }, []);

  // Cola offline
  const {
    items, pendingCount, isOnline,
    enqueueScan, enqueueClose, resolveError,
  } = useOfflineScanQueue({
    onConfirmed: handleConfirmed,
    onNotFound: handleNotFound,
    onClosed: handleClosed,
  });

  // Escaneo: encola y retorna inmediatamente (no bloquea)
  const handleScan = useCallback((tracking) => {
    const cleaned = (tracking || '').trim();
    if (!cleaned) return;
    setCode('');
    setManualAssign(null);
    enqueueScan(cleaned, 'lookup', []);
  }, [enqueueScan, setCode]);

  // Cerrar bulto: cierra localmente + encola cierre en servidor
  const handleCloseBulto = useCallback((bulto) => {
    updateBultosState((prev) => {
      const remaining = prev.filter((b) => b.id !== bulto.id);
      setActiveBultoId((curr) => (curr === bulto.id ? (remaining[0]?.id || null) : curr));
      return remaining;
    });
    setClosingBulto({ ...bulto, status: 'despachado' });
    toast.success(`Bulto ${bulto.bulto_number}/${bulto.total_bultos} cerrado`);
    setHistoryRefreshKey((k) => k + 1);
    enqueueClose(bulto.id, bulto);
  }, [updateBultosState, enqueueClose]);

  // Quitar último paquete del bulto
  const handleRemoveLast = useCallback(async (bulto) => {
    const ids = bulto.package_ids || [];
    if (!ids.length) return;
    const newIds = ids.slice(0, -1);
    try {
      if (newIds.length === 0) {
        await base44.functions.invoke('deleteBulto', { bulto_id: bulto.id });
        updateBultosState((prev) => {
          const remaining = prev.filter((b) => b.id !== bulto.id);
          setActiveBultoId((curr) => (curr === bulto.id ? (remaining[0]?.id || null) : curr));
          return remaining;
        });
        toast.success('Bulto vacío eliminado');
      } else {
        const res = await base44.functions.invoke('updateBulto', { bulto_id: bulto.id, package_ids: newIds });
        const updated = res?.data?.bulto || {
          ...bulto,
          package_ids: newIds,
          package_trackings: (bulto.package_trackings || []).slice(0, -1),
        };
        updateBultosState((prev) => prev.map((b) => (b.id === bulto.id ? updated : b)));
        toast.success('Último paquete quitado del bulto');
      }
    } catch (_) {
      toast.error('Error al quitar el paquete');
    }
  }, [updateBultosState]);

  // Asignación manual: crea el paquete y lo agrega al bulto
  const handleManualAssign = useCallback(async (client) => {
    if (!manualAssign) return;
    const { tracking, tempId } = manualAssign;
    setManualAssign(null);
    try {
      const now = new Date().toISOString();
      const pkg = await base44.entities.Package.create({
        tracking_number: tracking,
        client_email: client.email,
        shipping_mark: client.shipping_mark || '',
        shipping_type: 'maritimo',
        status: 'despachado',
        description: 'Paquete manual',
        received_date: now,
        dispatched_date: now,
        received_by: user?.email || '',
        dispatched_by: user?.email || '',
      });
      setLastScan({ package: pkg, client, auto_received: true });
      // Agregar al bulto
      try {
        const existing = await base44.entities.Bulto.filter(
          { client_email: client.email, status: 'activo' }, '-created_date', 1
        );
        let bultoData;
        if (existing?.[0]) {
          const newIds = [...(existing[0].package_ids || []), pkg.id];
          const res = await base44.functions.invoke('updateBulto', {
            bulto_id: existing[0].id, package_ids: newIds,
          });
          bultoData = res?.data?.bulto || existing[0];
        } else {
          const res = await base44.functions.invoke('createBulto', { package_ids: [pkg.id] });
          bultoData = res?.data?.bulto || res?.data;
        }
        if (bultoData?.id && bultoData.status === 'activo') {
          updateBultosState((prev) => {
            const exists = prev.find((b) => b.id === bultoData.id);
            return exists ? prev.map((b) => (b.id === bultoData.id ? bultoData : b)) : [...prev, bultoData];
          });
          setActiveBultoId(bultoData.id);
        }
      } catch (_) {}
      resolveError(tempId);
      toast.success(`Paquete manual asignado a ${client.full_name || client.email}`);
    } catch (e) {
      toast.error('Error al crear el paquete manual');
      setManualAssign({ tracking, tempId });
    }
  }, [manualAssign, user, updateBultosState, resolveError]);

  const activeBulto = useMemo(
    () => openBultos.find((b) => b.id === activeBultoId),
    [openBultos, activeBultoId]
  );

  // Filtrar items de la cola para mostrar
  const pendingItems = items.filter((i) => i.status !== 'done');
  const syncingItems = items.filter((i) => i.status === 'syncing');
  const errorItems = items.filter((i) => i.status === 'error');

  if (loadingAccess || loadingOpen) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }
  if (!allowed) {
    return <Card><CardContent className="p-8 text-center text-slate-500">No tienes acceso a este módulo.</CardContent></Card>;
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Boxes className="h-6 w-6 text-blue-600" /> Escanear y Armar Bultos
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Escanea el tracking: se agrega al bulto del cliente automáticamente. Funciona sin conexión — los escaneos se sincronizan en segundo plano.
        </p>
      </div>

      {/* Indicador de conexión */}
      <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
        isOnline ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-orange-50 text-orange-700 border border-orange-200'
      }`}>
        {isOnline ? <Cloud className="h-4 w-4 shrink-0" /> : <CloudOff className="h-4 w-4 shrink-0" />}
        <span>{isOnline ? 'En línea' : 'Sin conexión — escaneos se guardan localmente'}</span>
        {pendingCount > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs font-medium">
            <Clock className="h-3 w-3" /> {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <BarcodeScannerModule
        title="Escaneo de despacho y empaque"
        description="Usa la cámara, una lectora USB o escribe el tracking. El paquete se agrega al bulto al instante."
        placeholder="Escanea o escribe el tracking"
        actionLabel="Agregar"
        value={code}
        onValueChange={setCode}
        onDetected={handleScan}
        onPhotoCaptured={handlePhotoCaptured}
        continuous={true}
      />

      {/* Lista de escaneos pendientes/error */}
      {pendingItems.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2 text-amber-700">
              <CloudOff className="h-4 w-4 shrink-0" />
              <p className="text-sm font-semibold">Sincronizando ({pendingItems.length})</p>
            </div>
            <ul className="space-y-1 max-h-32 overflow-y-auto">
              {pendingItems.map((item) => (
                <li key={item.id} className="flex items-center gap-2 text-xs">
                  {item.status === 'syncing' ? (
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin text-blue-500" />
                  ) : item.status === 'error' ? (
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                  ) : (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400 animate-pulse" />
                  )}
                  <span className={`font-mono break-all ${
                    item.status === 'error' ? 'text-red-600' : 'text-slate-600'
                  }`}>
                    {item.tracking || 'Cierre de bulto'}
                  </span>
                  {item.status === 'error' && (
                    <span className="text-[10px] text-red-400 truncate ml-auto">{item.error_message}</span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Resultado del último escaneo confirmado */}
      {lastScan?.package && !lastScan.error && (
        <Card className="border-green-200">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              <p className="font-medium text-sm">
                Paquete agregado al bulto de {lastScan.client?.full_name || lastScan.package.client_email}
              </p>
            </div>
            <p className="text-xs text-slate-500 font-mono break-all">{lastScan.package.tracking_number}</p>
          </CardContent>
        </Card>
      )}

      {/* Panel de asignación manual (paquete no encontrado) */}
      {manualAssign && (
        <ManualPackageAssign
          tracking={manualAssign.tracking}
          onAssigned={handleManualAssign}
          onCancel={() => {
            setManualAssign(null);
            resolveError(manualAssign.tempId);
          }}
        />
      )}

      {/* Bulto activo */}
      {activeBulto ? (
        <OpenBultoCard
          bulto={activeBulto}
          onClose={() => handleCloseBulto(activeBulto)}
          onRemoveLast={() => handleRemoveLast(activeBulto)}
        />
      ) : (
        !pendingItems.length && (
          <Card>
            <CardContent className="p-8 text-center text-slate-500">
              <ScanLine className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">Escanea un paquete para abrir el primer bulto.</p>
            </CardContent>
          </Card>
        )
      )}

      {openBultos.length > 0 && (
        <OpenBultosChips
          bultos={openBultos}
          activeId={activeBultoId}
          onSelect={setActiveBultoId}
        />
      )}

      {closingBulto && (
        <Card className="border-green-200">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              <p className="font-medium">Bulto {closingBulto.bulto_number}/{closingBulto.total_bultos} cerrado: {closingBulto.label_code}</p>
            </div>
            <BluetoothPrinter bultos={[closingBulto]} onPrinted={() => setClosingBulto(null)} />
          </CardContent>
        </Card>
      )}

      {/* Historial de bultos */}
      <Card>
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="w-full flex items-center justify-between gap-2 p-4 text-left"
        >
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-blue-600" />
            <div>
              <p className="font-semibold text-slate-800 text-sm">Historial de bultos</p>
              <p className="text-xs text-slate-500">Ver, reimprimir, editar o eliminar bultos registrados</p>
            </div>
          </div>
          {showHistory ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
        </button>
        {showHistory && (
          <CardContent className="pt-0">
            <BultoHistory refreshKey={historyRefreshKey} />
          </CardContent>
        )}
      </Card>
    </div>
  );
}