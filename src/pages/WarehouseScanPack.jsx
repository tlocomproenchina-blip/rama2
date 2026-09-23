import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2, ScanLine, Boxes, AlertTriangle, CheckCircle2,
  CloudOff, Cloud, RefreshCw, Clock, Database, Check,
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
import { useOfflineWarehouse } from '@/hooks/useOfflineWarehouse';
import { History, ChevronDown, ChevronUp } from 'lucide-react';

// Página unificada offline-first: escanea tracking → busca localmente en IndexedDB
// → marca despachado + agrega al bulto del cliente. Funciona 100% offline.
// Los cambios se sincronizan al servidor en segundo plano al volver la conexión.
export default function WarehouseScanPack({ user }) {
  const { allowed, loading: loadingAccess } = useWarehouseAccess(user, 'WarehouseScanPack');
  const [code, setCode] = useState('');
  const [activeBultoId, setActiveBultoId] = useState(null);
  const [lastScan, setLastScan] = useState(null);
  const [closingBulto, setClosingBulto] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [manualAssign, setManualAssign] = useState(null);
  const [scanning, setScanning] = useState(false);
  const { handlePhotoCaptured, waitForPhoto } = useScannedPhotoUploader();

  const {
    online, cacheReady, caching, openBultos, pendingSync, syncing,
    cacheData, localScan, localManualAssign, localCloseBulto, localRemoveLast,
    searchClientsLocal, syncNow,
  } = useOfflineWarehouse();

  // Seleccionar bulto activo automáticamente
  useEffect(() => {
    if (openBultos.length && !activeBultoId) {
      setActiveBultoId(openBultos[0].id);
    }
    if (activeBultoId && !openBultos.find((b) => b.id === activeBultoId)) {
      setActiveBultoId(openBultos[0]?.id || null);
    }
  }, [openBultos]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeBulto = useMemo(
    () => openBultos.find((b) => b.id === activeBultoId),
    [openBultos, activeBultoId]
  );

  // Escaneo: busca localmente, marca despachado, agrega al bulto
  const handleScan = useCallback(async (tracking) => {
    const cleaned = (tracking || '').trim();
    if (!cleaned || scanning) return;
    setCode('');
    setManualAssign(null);
    setScanning(true);
    try {
      // Esperar foto si está capturando (requiere conexión; offline = sin foto)
      let photoUrls = [];
      try {
        const photoUrl = await waitForPhoto(cleaned);
        if (photoUrl) photoUrls = [photoUrl];
      } catch (_) {}
      const result = await localScan(cleaned, photoUrls);
      if (!result.found) {
        // No encontrado en cache local → abrir panel de asignación manual
        setManualAssign({ tracking: cleaned });
        toast.warning(`Tracking no encontrado en datos locales`, { duration: 2000 });
      } else {
        setLastScan({ package: result.package, bulto: result.bulto });
        setActiveBultoId(result.bulto.id);
        toast.success(`Paquete agregado al bulto`, { duration: 1500 });
      }
    } catch (e) {
      toast.error('Error al escanear: ' + (e?.message || ''));
    } finally {
      setScanning(false);
    }
  }, [scanning, localScan, waitForPhoto, setCode]);

  // Cerrar bulto: marca localmente + imprime etiqueta
  const handleCloseBulto = useCallback(async (bulto) => {
    try {
      await localCloseBulto(bulto);
      setClosingBulto({ ...bulto, status: 'despachado' });
      toast.success(`Bulto cerrado`);
      setHistoryRefreshKey((k) => k + 1);
    } catch (e) {
      toast.error('Error al cerrar bulto');
    }
  }, [localCloseBulto]);

  // Quitar último paquete
  const handleRemoveLast = useCallback(async (bulto) => {
    try {
      await localRemoveLast(bulto);
      toast.success('Último paquete quitado');
    } catch (_) {
      toast.error('Error al quitar el paquete');
    }
  }, [localRemoveLast]);

  // Asignación manual: crea paquete local + agrega al bulto
  const handleManualAssign = useCallback(async (client) => {
    if (!manualAssign) return;
    const tracking = manualAssign.tracking;
    setManualAssign(null);
    try {
      const result = await localManualAssign(tracking, client, []);
      setLastScan({ package: result.package, bulto: result.bulto });
      setActiveBultoId(result.bulto.id);
      toast.success(`Paquete asignado a ${client.full_name || client.email}`);
    } catch (e) {
      toast.error('Error al asignar paquete');
      setManualAssign({ tracking });
    }
  }, [manualAssign, localManualAssign]);

  if (loadingAccess) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }
  if (!allowed) {
    return <Card><CardContent className="p-8 text-center text-slate-500">No tienes acceso a este módulo.</CardContent></Card>;
  }

  // Estado de sincronización: offline / sincronizando / sincronizado
  const syncState = !online ? 'offline' : syncing ? 'syncing' : pendingSync > 0 ? 'pending' : 'synced';

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Boxes className="h-6 w-6 text-blue-600" /> Escanear y Armar Bultos
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Escanea el tracking: se agrega al bulto del cliente automáticamente. Funciona sin conexión — los cambios se sincronizan solos.
        </p>
      </div>

      {/* Indicador de estado offline/sync */}
      <div className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm border ${
        syncState === 'offline' ? 'bg-orange-50 text-orange-700 border-orange-200' :
        syncState === 'syncing' ? 'bg-blue-50 text-blue-700 border-blue-200' :
        syncState === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
        'bg-green-50 text-green-700 border-green-200'
      }`}>
        {syncState === 'offline' ? <CloudOff className="h-4 w-4 shrink-0" /> :
         syncState === 'syncing' ? <RefreshCw className="h-4 w-4 shrink-0 animate-spin" /> :
         syncState === 'pending' ? <Clock className="h-4 w-4 shrink-0" /> :
         <Check className="h-4 w-4 shrink-0" />}
        <span className="font-medium">
          {syncState === 'offline' ? 'Offline — datos locales' :
           syncState === 'syncing' ? 'Sincronizando...' :
           syncState === 'pending' ? `${pendingSync} pendiente${pendingSync !== 1 ? 's' : ''} de sincronizar` :
           'Sincronizado'}
        </span>
        {pendingSync > 0 && online && (
          <Button
            variant="ghost"
            size="sm"
            onClick={syncNow}
            disabled={syncing}
            className="ml-auto h-7 text-xs gap-1"
          >
            <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
            Sincronizar ahora
          </Button>
        )}
      </div>

      {/* Indicador de cache */}
      {caching && (
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
          <Database className="h-3.5 w-3.5 animate-pulse" />
          <span>Descargando datos al móvil para uso offline...</span>
        </div>
      )}
      {cacheReady && !caching && (
        <div className="flex items-center gap-2 text-xs text-green-600">
          <Database className="h-3.5 w-3.5" />
          <span>Datos offline listos</span>
        </div>
      )}

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

      {/* Indicador de escaneo en progreso */}
      {scanning && (
        <div className="flex items-center justify-center py-2">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          <span className="ml-2 text-sm text-slate-500">Buscando en datos locales...</span>
        </div>
      )}

      {/* Resultado del último escaneo */}
      {lastScan?.package && !lastScan.error && (
        <Card className="border-green-200">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              <p className="font-medium text-sm">
                Paquete agregado al bulto {lastScan.bulto?.shipping_mark || ''}
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
          onCancel={() => setManualAssign(null)}
          onAssignLater={() => setManualAssign(null)}
          searchClientsLocal={searchClientsLocal}
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
        !scanning && (
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
              <p className="font-medium">Bulto cerrado: {closingBulto.label_code}</p>
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