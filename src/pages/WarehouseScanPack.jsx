import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2, ScanLine, Boxes, AlertTriangle,
  CloudOff, Cloud, Package, X, RefreshCw, Clock, Wifi, WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import BarcodeScannerModule from '@/components/warehouse/BarcodeScannerModule';
import useWarehouseAccess from '@/hooks/useWarehouseAccess';
import OpenBultoCard from '@/components/warehouse/OpenBultoCard';
import OpenBultosChips from '@/components/warehouse/OpenBultosChips';
import BultoHistory from '@/components/warehouse/BultoHistory';
import ManualPackageAssign from '@/components/warehouse/ManualPackageAssign';
import BulkBultoCreator from '@/components/warehouse/BulkBultoCreator';
import CajaAssemblyPanel from '@/components/warehouse/CajaAssemblyPanel';
import ScanPhotoFailureNotice from '@/components/warehouse/ScanPhotoFailureNotice';
import useScannedPhotoUploader from '@/hooks/useScannedPhotoUploader';
import OfflineScanResult from '@/components/warehouse/OfflineScanResult';
import PrintQueueCard from '@/components/warehouse/PrintQueueCard';
import { usePrintQueue } from '@/hooks/usePrintQueue';
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
  const [showHistory, setShowHistory] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [manualAssign, setManualAssign] = useState(null);
  const [scanning, setScanning] = useState(false);
  const openBultosRef = useRef([]);
  const {
    handlePhotoCaptured, waitForPhoto, getPhotoStatus, retryPhoto,
  } = useScannedPhotoUploader();
  // Fotos de escaneo que no subieron: se avisan en pantalla y se pueden reintentar.
  const [failedPhotos, setFailedPhotos] = useState([]);
  const [photoRetrying, setPhotoRetrying] = useState(false);

  // Cola de impresión persistente (sobrevive recarga/cierre de app)
  const { queue: printQueue, enqueue: enqueuePrint, remove: removeFromQueue, removeMany: removeFromQueueMany, clear: clearPrintQueue } = usePrintQueue();

  // Hooks offline-first
  const {
    cacheReady, downloading, progress, lastSync, error: cacheError,
    refresh: refreshCache, refreshIfStale, findByLabelCode, findByTracking, getClientByEmail,
  } = useOfflineWarehouseData();

  const { block: numberBlock, getNextNumber, reserving: reservingBlock } = useBultoNumberBlock();

  const {
    pendingBultos, isSyncing, isOnline, enqueueClosedBulto, enqueueCaja, enqueuePackageReception, retrySync,
  } = useOfflineBultoSync();

  // Helper: actualiza la ref y el estado sincrónicamente
  const updateBultosState = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(openBultosRef.current) : updater;
    openBultosRef.current = next;
    setOpenBultos(next);
  }, []);

  // Cargar bultos abiertos de IndexedDB al montar (instantáneo)
  // + consolidar bultos duplicados por cliente en el servidor antes de mostrar
  useEffect(() => {
    if (!cacheReady) return;
    let cancelled = false;
    (async () => {
      // Consolidar duplicados en el servidor y refrescar caché antes de leer
      try {
        await base44.functions.invoke('consolidateOpenBultos', {});
        await refreshCache();
      } catch (_) {}
      if (cancelled) return;
      const localBultos = await getAll('bultos');
      const active = localBultos.filter((b) => b.status === 'activo' && !b.closed_at);
      updateBultosState(active);
      if (active.length && !activeBultoId) setActiveBultoId(active[0].id);
    })();
    return () => { cancelled = true; };
  }, [cacheReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Foto del escaneo ---
  // Adjunta la foto al paquete local y reencola su recepción para que llegue al
  // servidor (idempotente por id). Los paquetes creados a mano en el dispositivo no
  // se reencolan: todavía no existen en el servidor.
  const attachScanPhoto = useCallback(async (pkg, photoUrl) => {
    if (!pkg?.id || !photoUrl) return;
    const urls = [...(pkg.package_image_urls || []), photoUrl].slice(0, 3);
    const updatedPkg = {
      ...pkg,
      package_image_url: pkg.package_image_url || photoUrl,
      package_image_urls: urls,
    };
    await put('packages', updatedPkg);
    if (!pkg.is_local && !String(pkg.id).startsWith('local_')) {
      enqueuePackageReception(updatedPkg);
    }
  }, [enqueuePackageReception]);

  // Espera la foto capturada al escanear y la guarda. Si no sube, deja el código
  // avisado en pantalla: la foto nunca se descarta en silencio.
  const captureScanPhoto = useCallback(async (code, pkg) => {
    if (!getPhotoStatus(code)) return;
    const photoUrl = await waitForPhoto(code);
    if (photoUrl) {
      await attachScanPhoto(pkg, photoUrl);
      return;
    }
    setFailedPhotos((prev) => (prev.some((f) => f.code === code) ? prev : [...prev, { code, pkg }]));
  }, [getPhotoStatus, waitForPhoto, attachScanPhoto]);

  // --- Escaneo: lookup local instantáneo ---
  const handleScan = useCallback(async (tracking) => {
    const cleaned = (tracking || '').trim();
    if (!cleaned || scanning) return;
    setScanning(true);
    setCode('');
    setManualAssign(null);
    // Refresh inteligente antes de procesar el escaneo (reduce ventana de conflicto)
    refreshIfStale();
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
      const alreadyReceived = pkg.status === 'recibido' || pkg.status === 'despachado';
      const wasPreAlert = pkg.status === 'pre_alerta';

      // Actualizar paquete localmente (marcar recibido si no lo está)
      if (!alreadyReceived) {
        const now = new Date().toISOString();
        const updatedPkg = {
          ...pkg,
          status: 'recibido',
          received_date: now,
          received_by: user?.email || '',
        };
        await put('packages', updatedPkg);
        pkg = updatedPkg;
        // Encolar sincronización de recepción al servidor (multi-dispositivo)
        enqueuePackageReception(updatedPkg);
      }

      // Agregar al bulto del cliente (local)
      await addPackageToBulto(pkg, client);

      setLastScan({ pkg, client, already_received: alreadyReceived, auto_received: wasPreAlert });
      toast.success(`Paquete recibido y agregado al bulto`, { duration: 1500 });

      // Foto tomada automáticamente al escanear el código: se guarda en el paquete y
      // se reencola su recepción. Si no sube, queda avisada arriba para reintentar.
      captureScanPhoto(cleaned, pkg).catch(() => {});
    } catch (e) {
      console.error('Scan error:', e);
      toast.error('Error al procesar el escaneo');
    } finally {
      setScanning(false);
    }
  }, [findByLabelCode, findByTracking, getClientByEmail, scanning, user, updateBultosState, captureScanPhoto]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Agregar paquete al bulto activo del cliente (local) ---
  const addPackageToBulto = useCallback(async (pkg, client) => {
    const clientEmail = pkg.client_email;
    const shippingMark = pkg.shipping_mark || client?.shipping_mark || '';

    // Buscar bulto abierto (activo y sin cerrar) de este cliente en local
    const localBultos = await getAll('bultos');
    let bulto = localBultos.find((b) => b.client_email === clientEmail && b.status === 'activo' && !b.closed_at);

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
  // Acepta un override manual de números de orden (array de strings) o null.
  const handleCloseBulto = useCallback(async (bulto, manualOrderNumbers) => {
    if (!bulto) return;
    // Cerrar bulto: status 'en_almacen_ve' (sellado, en almacén, esperando despacho
    // y facturación). Es el mismo estado que usa el resto del sistema, así el bulto
    // aparece en facturación y en el portal del cliente. El servidor lo confirma
    // vía syncBultoBatch.
    let cbmOrderNumbers = Array.isArray(bulto.cbm_order_numbers) ? bulto.cbm_order_numbers : [];
    if (manualOrderNumbers && manualOrderNumbers.length > 0) {
      cbmOrderNumbers = manualOrderNumbers;
    }
    const closedBulto = { ...bulto, status: 'en_almacen_ve', closed_at: new Date().toISOString(), cbm_order_numbers: cbmOrderNumbers };
    await put('bultos', closedBulto);

    // Quitar de bultos abiertos
    updateBultosState((prev) => {
      const remaining = prev.filter((b) => b.id !== bulto.id);
      setActiveBultoId((curr) => (curr === bulto.id ? (remaining[0]?.id || null) : curr));
      return remaining;
    });

    // Encolar en la cola de impresión persistente (se imprime al acercarse a la impresora)
    await enqueuePrint(closedBulto);
    toast.success(`Bulto ${bulto.bulto_number} cerrado — encolado para impresión (${printQueue.length + 1} en cola)`);

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
      cbm_order_numbers: cbmOrderNumbers,
      warehouse_id: closedBulto.warehouse_id || '',
      created_by: closedBulto.created_by || user?.email || '',
      closed_at: closedBulto.closed_at,
    });

    setHistoryRefreshKey((k) => k + 1);
  }, [updateBultosState, enqueueClosedBulto, user]);

  // --- Quitar último paquete del bulto (local) ---
  // Si el paquete fue creado manualmente offline (is_local), también se borra
  // del store 'packages' para que re-escanear el tracking vuelva a abrir el
  // panel de asignación manual y se pueda elegir otro cliente.
  const handleRemoveLast = useCallback(async (bulto) => {
    const ids = bulto.package_ids || [];
    if (!ids.length) return;
    const removedId = ids[ids.length - 1];
    const newIds = ids.slice(0, -1);
    try {
      // Borrar paquete manual del store local si aplica
      const allPkgs = await getAll('packages');
      const removedPkg = allPkgs.find((p) => p.id === removedId);
      if (removedPkg?.is_local) {
        await del('packages', removedId);
      }

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

  // --- Guardar el N° de orden del bulto activo (local, antes de cerrarlo) ---
  const handleOrderChange = useCallback(async (orders) => {
    const bulto = openBultosRef.current.find((b) => b.id === activeBultoId);
    if (!bulto) return;
    const updated = { ...bulto, cbm_order_numbers: orders };
    await put('bultos', updated);
    updateBultosState((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  }, [activeBultoId, updateBultosState]);

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
        status: 'recibido',
        description: 'Paquete manual (offline)',
        received_date: now,
        received_by: user?.email || '',
        is_local: true,
      };
      await put('packages', pkg);
      await addPackageToBulto(pkg, client);
      setLastScan({ pkg, client, already_received: false, auto_received: true });
      toast.success(`Paquete manual asignado a ${client.full_name || client.email}`);
    } catch (e) {
      toast.error('Error al crear el paquete manual');
      setManualAssign({ tracking });
    }
  }, [manualAssign, user, addPackageToBulto]);

  // --- Reintentar las fotos de escaneo que no subieron ---
  const handleRetryFailedPhotos = useCallback(async () => {
    if (!failedPhotos.length) return;
    setPhotoRetrying(true);
    const stillFailed = [];
    for (const entry of failedPhotos) {
      const photoUrl = await retryPhoto(entry.code);
      if (photoUrl) await attachScanPhoto(entry.pkg, photoUrl);
      else stillFailed.push(entry);
    }
    setPhotoRetrying(false);
    setFailedPhotos(stillFailed);
    if (stillFailed.length) {
      toast.error('Algunas fotos siguen sin subir. Revisa tu conexión e intenta de nuevo.');
    } else {
      toast.success('Fotos guardadas en sus paquetes');
    }
  }, [failedPhotos, retryPhoto, attachScanPhoto]);

  const activeBulto = useMemo(
    () => openBultos.find((b) => b.id === activeBultoId),
    [openBultos, activeBultoId]
  );

  // --- Registrar bultos creados en lote (sellados en almacén) ---
  // Los bultos del lote se crean sellados con status 'en_almacen_ve', así que no van a
  // openBultos. Se muestran en la zona de impresión y se reflejan en historial.
  const handleBulkCreated = useCallback(async (newBultos) => {
    if (!newBultos?.length) return;
    // Encolar todos los bultos del lote en la cola de impresión
    for (const b of newBultos) {
      await enqueuePrint(b);
    }
    setHistoryRefreshKey((k) => k + 1);
  }, [enqueuePrint]);

  // Etiqueta del lote que no se registró (su código ya existía en el sistema): se
  // descarta del dispositivo y de la cola de impresión para no imprimirla por error.
  const handleDiscardBulto = useCallback(async (bulto) => {
    if (!bulto?.id) return;
    try { await del('bultos', bulto.id); } catch (_) {}
    await removeFromQueue(bulto.id);
    setHistoryRefreshKey((k) => k + 1);
  }, [removeFromQueue]);

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
          Escanea el tracking: el paquete se marca como recibido y se agrega al bulto del cliente (offline). Al cerrar el bulto, queda listo para despachar en la pantalla de Despacho.
        </p>
      </div>

      {/* Indicador de conexión + sincronización + bloque de números (una sola línea) */}
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-sm ${
        isOnline ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-orange-50 text-orange-700 border border-orange-200'
      }`}>
        {isOnline ? <Wifi className="h-4 w-4 shrink-0" /> : <WifiOff className="h-4 w-4 shrink-0" />}
        <span>{isOnline ? 'En línea' : 'Sin conexión — modo offline'}</span>
        {lastSync && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Clock className="h-3 w-3" />
            Últ. sync: {new Date(lastSync).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {numberBlock && (
          <span className="flex items-center gap-1 text-xs text-blue-700">
            <Package className="h-3.5 w-3.5 shrink-0" />
            Números de bulto: {numberBlock.next_number}–{numberBlock.end}
            {reservingBlock && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
          </span>
        )}
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

      <BarcodeScannerModule
        title="Recepción y empaque de bultos"
        description="Usa la cámara, una lectora USB o escribe el tracking. El paquete se marca como recibido y se agrega al bulto al instante. La cámara toma una foto automática de cada código escaneado y la guarda en el paquete."
        placeholder="Escanea o escribe el tracking"
        actionLabel="Agregar"
        value={code}
        onValueChange={setCode}
        onDetected={handleScan}
        onPhotoCaptured={handlePhotoCaptured}
        continuous={true}
      />

      {/* Fotos de escaneo que no subieron */}
      {failedPhotos.length > 0 && (
        <ScanPhotoFailureNotice
          codes={failedPhotos.map((f) => f.code)}
          retrying={photoRetrying}
          onRetry={handleRetryFailedPhotos}
          onSkip={() => setFailedPhotos([])}
          skipLabel="Continuar sin esas fotos"
          description="Esas fotos no se guardaron en el paquete. Reintenta la subida o continúa sin ellas (el paquete ya quedó en el bulto)."
        />
      )}

      {/* Crear bultos en lote (vacíos, solo etiquetas) */}
      <BulkBultoCreator
        getNextNumber={getNextNumber}
        user={user}
        onCreated={handleBulkCreated}
        enqueueClosedBulto={enqueueClosedBulto}
        pendingBultos={pendingBultos}
        retrySync={retrySync}
        onDiscardBulto={handleDiscardBulto}
      />

      {/* Caja consolidada: se arman los bultos pequeños dentro de la caja que se despacha */}
      <CajaAssemblyPanel user={user} getNextNumber={getNextNumber} enqueueCaja={enqueueCaja} />

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
          onClose={(orders) => handleCloseBulto(activeBulto, orders)}
          onRemoveLast={() => handleRemoveLast(activeBulto)}
          onOrderChange={handleOrderChange}
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

      {/* Cola de impresión persistente */}
      <PrintQueueCard
        queue={printQueue}
        onRemove={removeFromQueue}
        onClear={clearPrintQueue}
        onPrintedAll={removeFromQueueMany}
      />

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