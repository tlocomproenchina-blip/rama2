import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2, ScanLine, Boxes, AlertTriangle, CheckCircle2,
  CloudOff, Cloud, Package, X, RefreshCw, Clock, Wifi, WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import BarcodeScannerModule from '@/components/warehouse/BarcodeScannerModule';
import BluetoothPrinter from '@/components/warehouse/BluetoothPrinter';
import useWarehouseAccess from '@/hooks/useWarehouseAccess';
import OpenBultoCard from '@/components/warehouse/OpenBultoCard';
import OpenBultosChips from '@/components/warehouse/OpenBultosChips';
import BultoHistory from '@/components/warehouse/BultoHistory';
import ManualPackageAssign from '@/components/warehouse/ManualPackageAssign';
import BulkBultoCreator from '@/components/warehouse/BulkBultoCreator';
import OfflineScanResult from '@/components/warehouse/OfflineScanResult';
import { useOfflineWarehouseData } from '@/hooks/useOfflineWarehouseData';
import { useBultoNumberBlock } from '@/hooks/useBultoNumberBlock';
import { useOfflineBultoSync } from '@/hooks/useOfflineBultoSync';
import { getAll, put, bulkPut, del } from '@/lib/offlineDb';
import { History, ChevronDown, ChevronUp } from 'lucide-react';

// Página offline-first: escanea tracking → lookup local instantáneo (IndexedDB)
// → agrega al bulto del cliente → al cerrar, imprime etiqueta y sincroniza en segundo plano.
export default function WarehouseScanPack({ user }) {
  const { allowed, loading: loadingAccess } = useWarehouseAccess(user, 'WarehouseScanPack');
  const [code, setCode] = useState('');
  const [openBultos, setOpenBultos] = useState([]);
  const [activeBultoId, setActiveBultoId] = useState(null);
  const [lastScan, setLastScan] = useState(null);
  const [closingBulto, setClosingBulto] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [manualAssign, setManualAssign] = useState(null);
  const [scanning, setScanning] = useState(false);
  const openBultosRef = useRef([]);

  // Hooks offline-first
  const {
    cacheReady, downloading, progress, lastSync, error: cacheError,
    refresh: refreshCache, findByLabelCode, findByTracking, getClientByEmail,
  } = useOfflineWarehouseData();

  const { block: numberBlock, getNextNumber, reserving: reservingBlock } = useBultoNumberBlock();

  const {
    pendingBultos, isSyncing, isOnline, enqueueClosedBulto, retrySync,
  } = useOfflineBultoSync();

  // Helper: actualiza la ref y el estado sincrónicamente
  const updateBultosState = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(openBultosRef.current) : updater;
    openBultosRef.current = next;
    setOpenBultos(next);
  }, []);

  // Cargar bultos abiertos de IndexedDB al montar (instantáneo)
  useEffect(() => {
    if (!cacheReady) return;
    (async () => {
      const localBultos = await getAll('bultos');
      const active = localBultos.filter((b) => b.status === 'activo');
      updateBultosState(active);
      if (active.length && !activeBultoId) setActiveBultoId(active[0].id);
    })();
  }, [cacheReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Escaneo: lookup local instantáneo ---
  const handleScan = useCallback(async (tracking) => {
    const cleaned = (tracking || '').trim();
    if (!cleaned || scanning) return;
    setScanning(true);
    setCode('');
    setManualAssign(null);
    try {
      // 1) Buscar por label_code (código de etiqueta TLEC)
      let pkg = await findByLabelCode(cleaned);
      // 2) Buscar por tracking_number con sub-tracking
      if (!pkg) pkg = await findByTracking(cleaned);

      if (!pkg) {
        // No encontrado: asignación manual
        setManualAssign({ tracking: cleaned });
        return;
      }

      // Buscar cliente localmente
      const client = pkg.client_email ? await getClientByEmail(pkg.client_email) : null;
      const alreadyDispatched = pkg.status === 'despachado';
      const autoReceived = pkg.status === 'pre_alerta';

      // Actualizar paquete localmente (marcar despachado si no lo está)
      if (!alreadyDispatched) {
        const now = new Date().toISOString();
        const updatedPkg = {
          ...pkg,
          status: 'despachado',
          dispatched_date: now,
          dispatched_by: user?.email || '',
          ...(autoReceived ? { received_date: now, received_by: user?.email || '' } : {}),
        };
        await put('packages', updatedPkg);
        pkg = updatedPkg;
      }

      // Agregar al bulto del cliente (local)
      await addPackageToBulto(pkg, client);

      setLastScan({ pkg, client, already_dispatched: alreadyDispatched, auto_received: autoReceived });
      toast.success(`Paquete agregado al bulto`, { duration: 1500 });
    } catch (e) {
      console.error('Scan error:', e);
      toast.error('Error al procesar el escaneo');
    } finally {
      setScanning(false);
    }
  }, [findByLabelCode, findByTracking, getClientByEmail, scanning, user, updateBultosState]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Agregar paquete al bulto activo del cliente (local) ---
  const addPackageToBulto = useCallback(async (pkg, client) => {
    const clientEmail = pkg.client_email;
    const shippingMark = pkg.shipping_mark || client?.shipping_mark || '';

    // Buscar bulto activo de este cliente en local
    const localBultos = await getAll('bultos');
    let bulto = localBultos.find((b) => b.client_email === clientEmail && b.status === 'activo');

    if (!bulto) {
      // Crear bulto local con número reservado
      const bultoNumber = await getNextNumber();
      if (!bultoNumber) {
        toast.error('No hay números de bulto disponibles. Revisa tu conexión.');
        return;
      }
      const labelCode = `${shippingMark}-B${bultoNumber}`;
      const clientSnapshot = {
        full_name: client?.full_name || '',
        email: client?.email || clientEmail,
        cedula: client?.cedula || '',
        whatsapp: client?.whatsapp || '',
        address: client?.address || '',
        city: client?.city || '',
        state: client?.state || '',
        shipping_mark: shippingMark,
      };
      bulto = {
        id: `local_bulto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        label_code: labelCode,
        client_email: clientEmail,
        shipping_mark: shippingMark,
        bulto_number: bultoNumber,
        total_bultos: bultoNumber,
        package_ids: [pkg.id],
        package_trackings: [pkg.tracking_number].filter(Boolean),
        client_snapshot: clientSnapshot,
        invoice_paid: false,
        invoice_status: '',
        invoice_number: '',
        warehouse_id: '',
        status: 'activo',
        created_by: user?.email || '',
        is_local: true,
      };
      await put('bultos', bulto);
    } else {
      // Agregar paquete al bulto existente
      bulto = {
        ...bulto,
        package_ids: [...(bulto.package_ids || []), pkg.id],
        package_trackings: [...(bulto.package_trackings || []), pkg.tracking_number].filter(Boolean),
      };
      await put('bultos', bulto);
    }

    // Actualizar estado de bultos abiertos
    updateBultosState((prev) => {
      const exists = prev.find((b) => b.id === bulto.id);
      if (exists) return prev.map((b) => (b.id === bulto.id ? bulto : b));
      return [...prev, bulto];
    });
    setActiveBultoId(bulto.id);
  }, [getNextNumber, user, updateBultosState]);

  // --- Cerrar bulto: imprimir etiqueta + sincronizar en segundo plano ---
  const handleCloseBulto = useCallback(async (bulto) => {
    if (!bulto) return;
    // Marcar como despachado localmente
    const closedBulto = { ...bulto, status: 'despachado', closed_at: new Date().toISOString() };
    await put('bultos', closedBulto);

    // Quitar de bultos abiertos
    updateBultosState((prev) => {
      const remaining = prev.filter((b) => b.id !== bulto.id);
      setActiveBultoId((curr) => (curr === bulto.id ? (remaining[0]?.id || null) : curr));
      return remaining;
    });

    // Mostrar para impresión inmediata
    setClosingBulto(closedBulto);
    toast.success(`Bulto ${bulto.bulto_number} cerrado — imprimiendo etiqueta`);

    // Encolar sincronización en segundo plano
    await enqueueClosedBulto({
      local_bulto_id: closedBulto.id,
      label_code: closedBulto.label_code,
      client_email: closedBulto.client_email,
      shipping_mark: closedBulto.shipping_mark,
      bulto_number: closedBulto.bulto_number,
      total_bultos: closedBulto.total_bultos,
      package_ids: closedBulto.package_ids || [],
      package_trackings: closedBulto.package_trackings || [],
      client_snapshot: closedBulto.client_snapshot || {},
      invoice_paid: closedBulto.invoice_paid || false,
      invoice_status: closedBulto.invoice_status || '',
      invoice_number: closedBulto.invoice_number || '',
      warehouse_id: closedBulto.warehouse_id || '',
      created_by: closedBulto.created_by || user?.email || '',
      closed_at: closedBulto.closed_at,
    });

    setHistoryRefreshKey((k) => k + 1);
  }, [updateBultosState, enqueueClosedBulto, user]);

  // --- Quitar último paquete del bulto (local) ---
  const handleRemoveLast = useCallback(async (bulto) => {
    const ids = bulto.package_ids || [];
    if (!ids.length) return;
    const newIds = ids.slice(0, -1);
    try {
      if (newIds.length === 0) {
        // Eliminar bulto local
        await del('bultos', bulto.id);
        updateBultosState((prev) => {
          const remaining = prev.filter((b) => b.id !== bulto.id);
          setActiveBultoId((curr) => (curr === bulto.id ? (remaining[0]?.id || null) : curr));
          return remaining;
        });
        toast.success('Bulto vacío eliminado');
      } else {
        const updated = {
          ...bulto,
          package_ids: newIds,
          package_trackings: (bulto.package_trackings || []).slice(0, -1),
        };
        await put('bultos', updated);
        updateBultosState((prev) => prev.map((b) => (b.id === bulto.id ? updated : b)));
        toast.success('Último paquete quitado del bulto');
      }
    } catch (_) {
      toast.error('Error al quitar el paquete');
    }
  }, [updateBultosState]);

  // --- Asignación manual de huérfano (local) ---
  const handleManualAssign = useCallback(async (client) => {
    if (!manualAssign) return;
    const { tracking } = manualAssign;
    setManualAssign(null);
    try {
      // Crear paquete localmente
      const now = new Date().toISOString();
      const pkgId = `local_pkg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const pkg = {
        id: pkgId,
        tracking_number: tracking,
        client_email: client.email,
        shipping_mark: client.shipping_mark || '',
        shipping_type: 'maritimo',
        status: 'despachado',
        description: 'Paquete manual (offline)',
        received_date: now,
        dispatched_date: now,
        received_by: user?.email || '',
        dispatched_by: user?.email || '',
        is_local: true,
      };
      await put('packages', pkg);
      await addPackageToBulto(pkg, client);
      setLastScan({ pkg, client, already_dispatched: false, auto_received: true });
      toast.success(`Paquete manual asignado a ${client.full_name || client.email}`);
    } catch (e) {
      toast.error('Error al crear el paquete manual');
      setManualAssign({ tracking });
    }
  }, [manualAssign, user, addPackageToBulto]);

  const activeBulto = useMemo(
    () => openBultos.find((b) => b.id === activeBultoId),
    [openBultos, activeBultoId]
  );

  // --- Registrar bultos creados en lote en el estado local ---
  const handleBulkCreated = useCallback((newBultos) => {
    if (!newBultos?.length) return;
    updateBultosState((prev) => {
      // Evitar duplicados por id
      const existing = new Set(prev.map((b) => b.id));
      const merged = [...prev, ...newBultos.filter((b) => !existing.has(b.id))];
      return merged;
    });
    // Activar el primer bulto del lote si no hay ninguno activo
    if (!activeBultoId) setActiveBultoId(newBultos[0].id);
    setHistoryRefreshKey((k) => k + 1);
  }, [updateBultosState, activeBultoId]);

  // --- Estados de carga ---

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

  // Descarga inicial de caché (bloquea hasta completar si no hay caché)
  if (!cacheReady) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Boxes className="h-6 w-6 text-blue-600" /> Escanear y Armar Bultos
          </h1>
          <p className="text-sm text-slate-500 mt-1">Preparando datos offline…</p>
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <div className="flex-1">
                <p className="font-medium text-sm text-slate-800">{progress.phase || 'Iniciando…'}</p>
                <p className="text-xs text-slate-500">
                  {progress.clients > 0 && `${progress.clients} clientes · `}
                  {progress.packages > 0 && `${progress.packages} paquetes · `}
                  {progress.bultos > 0 && `${progress.bultos} bultos`}
                </p>
              </div>
            </div>
            {cacheError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {cacheError}
              </div>
            )}
            <Button onClick={refreshCache} variant="outline" className="w-full">
              <RefreshCw className="h-4 w-4" /> Reintentar descarga
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Boxes className="h-6 w-6 text-blue-600" /> Escanear y Armar Bultos
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Escanea el tracking: se agrega al bulto del cliente al instante (offline). Sincroniza al cerrar el bulto.
        </p>
      </div>

      {/* Indicador de conexión + sincronización */}
      <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
        isOnline ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-orange-50 text-orange-700 border border-orange-200'
      }`}>
        {isOnline ? <Wifi className="h-4 w-4 shrink-0" /> : <WifiOff className="h-4 w-4 shrink-0" />}
        <span>{isOnline ? 'En línea' : 'Sin conexión — modo offline'}</span>
        {pendingBultos.length > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs font-medium">
            <Clock className="h-3 w-3" /> {pendingBultos.length} bulto{pendingBultos.length !== 1 ? 's' : ''} por sincronizar
          </span>
        )}
        {isSyncing && (
          <span className="ml-auto flex items-center gap-1 text-xs font-medium text-blue-600">
            <Loader2 className="h-3 w-3 animate-spin" /> Sincronizando…
          </span>
        )}
      </div>

      {/* Estado del bloque de números */}
      {numberBlock && (
        <div className="flex items-center gap-2 rounded-lg bg-blue-50/60 border border-blue-100 px-3 py-1.5 text-xs text-blue-700">
          <Package className="h-3.5 w-3.5 shrink-0" />
          <span>Números de bulto: {numberBlock.next_number}–{numberBlock.end}</span>
          {reservingBlock && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
        </div>
      )}

      {/* Crear bultos en lote (vacíos, solo etiquetas) */}
      <BulkBultoCreator
        getNextNumber={getNextNumber}
        user={user}
        onCreated={handleBulkCreated}
      />

      <BarcodeScannerModule
        title="Escaneo de despacho y empaque"
        description="Usa la cámara, una lectora USB o escribe el tracking. El paquete se agrega al bulto al instante."
        placeholder="Escanea o escribe el tracking"
        actionLabel="Agregar"
        value={code}
        onValueChange={setCode}
        onDetected={handleScan}
        continuous={true}
      />

      {/* Resultado del último escaneo (instantáneo, local) */}
      {lastScan?.pkg && (
        <OfflineScanResult scanResult={lastScan} client={lastScan.client} />
      )}

      {/* Panel de asignación manual (paquete no encontrado) */}
      {manualAssign && (
        <ManualPackageAssign
          tracking={manualAssign.tracking}
          onAssigned={handleManualAssign}
          onCancel={() => setManualAssign(null)}
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
        !pendingBultos.length && (
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

      {/* Bulto recién cerrado: impresión inmediata */}
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

      {/* Bultos pendientes de sincronizar */}
      {pendingBultos.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2 text-amber-700">
              <CloudOff className="h-4 w-4 shrink-0" />
              <p className="text-sm font-semibold">Bultos por sincronizar ({pendingBultos.length})</p>
              {!isSyncing && isOnline && (
                <Button variant="ghost" size="sm" onClick={retrySync} className="ml-auto h-7 text-xs">
                  <RefreshCw className="h-3 w-3" /> Reintentar
                </Button>
              )}
            </div>
            <ul className="space-y-1 max-h-32 overflow-y-auto">
              {pendingBultos.map((item) => (
                <li key={item.id} className="flex items-center gap-2 text-xs">
                  {item.sync_status === 'syncing' ? (
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin text-blue-500" />
                  ) : item.sync_status === 'error' ? (
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                  ) : (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400 animate-pulse" />
                  )}
                  <span className={`font-mono break-all ${
                    item.sync_status === 'error' ? 'text-red-600' : 'text-slate-600'
                  }`}>
                    {item.label_code || 'Bulto'}
                  </span>
                  {item.sync_status === 'error' && (
                    <span className="text-[10px] text-red-400 truncate ml-auto">{item.error_message}</span>
                  )}
                </li>
              ))}
            </ul>
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