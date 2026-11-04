import React, { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, History, Loader2, RefreshCw, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import BarcodeScannerModule from '@/components/warehouse/BarcodeScannerModule';
import useWarehouseAccess from '@/hooks/useWarehouseAccess';
import OpenBultoCard from '@/components/warehouse/OpenBultoCard';
import CajaActiveCard from '@/components/warehouse/CajaActiveCard';
import CajaLotList from '@/components/warehouse/CajaLotList';
import CajaLabelsDialog from '@/components/warehouse/CajaLabelsDialog';
import PackDestinationSelector from '@/components/warehouse/PackDestinationSelector';
import PackUnitChips from '@/components/warehouse/PackUnitChips';
import PackStatusBar from '@/components/warehouse/PackStatusBar';
import PackPendingSyncCard from '@/components/warehouse/PackPendingSyncCard';
import PendingScanCodeCard from '@/components/warehouse/PendingScanCodeCard';
import ScanClientPicker from '@/components/warehouse/ScanClientPicker';
import AbsorbBultosConfirmDialog from '@/components/warehouse/AbsorbBultosConfirmDialog';
import BultoHistory from '@/components/warehouse/BultoHistory';
import ManualPackageAssign from '@/components/warehouse/ManualPackageAssign';
import BulkBultoCreator from '@/components/warehouse/BulkBultoCreator';
import ScanPhotoFailureNotice from '@/components/warehouse/ScanPhotoFailureNotice';
import OfflineScanResult from '@/components/warehouse/OfflineScanResult';
import PrintQueueCard from '@/components/warehouse/PrintQueueCard';
import useScannedPhotoUploader from '@/hooks/useScannedPhotoUploader';
import { usePrintQueue } from '@/hooks/usePrintQueue';
import { useOfflineWarehouseData } from '@/hooks/useOfflineWarehouseData';
import { useBultoNumberBlock } from '@/hooks/useBultoNumberBlock';
import { useOfflineBultoSync } from '@/hooks/useOfflineBultoSync';
import usePackUnit from '@/hooks/usePackUnit';
import { localCajasOfClient } from '@/lib/cajaLocal';
import { del, put, findPackageByTracking } from '@/lib/offlineDb';
import PackageReviewPanel from '@/components/warehouse/PackageReviewPanel';
import ReviewQueueCard from '@/components/warehouse/ReviewQueueCard';
import useReviewQueue from '@/hooks/useReviewQueue';
import useSharedPackUnits from '@/hooks/useSharedPackUnits';

// Mesa única de empaque (offline-first): un solo escáner recibe el paquete y lo deja en la
// unidad del cliente que indique el selector (bulto suelto o caja consolidada). La unidad
// que el cliente ya tenía abierta se retoma sola, y el cierre de cada tipo mantiene su
// operativa: etiqueta individual del bulto o tira continua de etiquetas de la caja.
export default function WarehouseScanPack({ user }) {
  const { allowed, loading: loadingAccess } = useWarehouseAccess(user, 'WarehouseScanPack');
  const [code, setCode] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [autoPrintLabels, setAutoPrintLabels] = useState(false);
  const [lotKey, setLotKey] = useState(0);
  const [lotEmail, setLotEmail] = useState('');
  const [cajas, setCajas] = useState([]);
  const [review, setReview] = useState(null);
  const [lastReview, setLastReview] = useState(null);
  const reviewQueue = useReviewQueue();

  const {
    handlePhotoCaptured, waitForPhoto, getPhotoStatus, retryPhoto,
  } = useScannedPhotoUploader();
  // Fotos de escaneo que no subieron: se avisan en pantalla y se pueden reintentar.
  const [failedPhotos, setFailedPhotos] = useState([]);
  const [photoRetrying, setPhotoRetrying] = useState(false);

  // Cola de impresión persistente (sobrevive recarga/cierre de app)
  const {
    queue: printQueue, enqueue: enqueuePrint, remove: removeFromQueue,
    removeMany: removeFromQueueMany, clear: clearPrintQueue,
  } = usePrintQueue();

  // Hooks offline-first
  const {
    cacheReady, downloading, progress, lastSync, error: cacheError,
    refresh: refreshCache, refreshIfStale, getClientByEmail,
  } = useOfflineWarehouseData();

  const { block: numberBlock, getNextNumber, reserving: reservingBlock } = useBultoNumberBlock();

  const {
    pendingBultos, isSyncing, isOnline, enqueueClosedBulto, enqueueCaja, enqueuePackageReception, retrySync,
  } = useOfflineBultoSync();

  // Adjunta la foto del escaneo al paquete local y reencola su recepción para que llegue
  // al servidor (idempotente por id). Los paquetes creados a mano en el dispositivo no se
  // reencolan: todavía no existen en el servidor.
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

  // Espera la foto capturada al escanear y la guarda. Si no sube, deja el código avisado
  // en pantalla: la foto nunca se descarta en silencio.
  const captureScanPhoto = useCallback(async (scannedCode, pkg) => {
    if (!getPhotoStatus(scannedCode)) return;
    const photoUrl = await waitForPhoto(scannedCode);
    if (photoUrl) {
      await attachScanPhoto(pkg, photoUrl);
      return;
    }
    setFailedPhotos((prev) => (prev.some((f) => f.code === scannedCode) ? prev : [...prev, { code: scannedCode, pkg }]));
  }, [getPhotoStatus, waitForPhoto, attachScanPhoto]);

  // Cajas y bultos en armado compartidos en línea con el resto del equipo.
  const packRef = useRef(null);
  const shared = useSharedPackUnits({ onRemoteChange: () => packRef.current?.reloadUnits() });

  const pack = usePackUnit({
    user,
    onUnitChange: shared.pushChange,
    onUnitRemoved: shared.pushStatus,
    getNextNumber,
    getClientByEmail,
    enqueueClosedBulto,
    enqueueCaja,
    enqueuePackageReception,
    enqueuePrint,
    captureScanPhoto,
    onHistoryChange: () => {
      setHistoryRefreshKey((k) => k + 1);
      setLotKey((k) => k + 1);
    },
  });
  packRef.current = pack;

  // Cargar unidades abiertas de IndexedDB (instantáneo) tras consolidar duplicados en el
  // servidor y refrescar el caché.
  useEffect(() => {
    if (!cacheReady) return undefined;
    let cancelled = false;
    (async () => {
      try {
        await base44.functions.invoke('consolidateOpenBultos', {});
        await refreshCache();
      } catch (_) {}
      await shared.pullAll();
      if (!cancelled) await pack.reloadUnits();
    })();
    return () => { cancelled = true; };
  }, [cacheReady]);  

  // Cliente del lote en pantalla: el de la unidad activa o el último con el que se trabajó.
  useEffect(() => {
    if (pack.activeUnit?.client_email) setLotEmail(pack.activeUnit.client_email);
  }, [pack.activeUnit]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!lotEmail) {
        setCajas([]);
        return;
      }
      const list = await localCajasOfClient(lotEmail).catch(() => []);
      if (!cancelled) setCajas(list);
    })();
    return () => { cancelled = true; };
  }, [lotEmail, lotKey, pendingBultos.length]);

  // Cuando una caja cerrada termina de registrarse en el servidor, se imprime sola su
  // tira de etiquetas continuas (ya con la numeración X/N definitiva).
  const pendingCajasRef = useRef(new Map());
  useEffect(() => {
    const current = new Map(
      pendingBultos.filter((p) => p.type === 'caja').map((p) => [p.id, p.client_email])
    );
    for (const [id, email] of pendingCajasRef.current) {
      if (!current.has(id) && email) {
        setLotEmail(email);
        setAutoPrintLabels(true);
        setLabelsOpen(true);
        break;
      }
    }
    pendingCajasRef.current = current;
  }, [pendingBultos]);

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

  // --- Registrar bultos creados en lote (sellados en almacén) ---
  const handleBulkCreated = useCallback(async (newBultos) => {
    if (!newBultos?.length) return;
    for (const b of newBultos) {
      await enqueuePrint(b);
    }
    setHistoryRefreshKey((k) => k + 1);
  }, [enqueuePrint]);

  // Etiqueta del lote que no se registró (su código ya existía en el sistema): se descarta
  // del dispositivo y de la cola de impresión para no imprimirla por error.
  const handleDiscardBulto = useCallback(async (bulto) => {
    if (!bulto?.id) return;
    try { await del('bultos', bulto.id); } catch (_) {}
    await removeFromQueue(bulto.id);
    setHistoryRefreshKey((k) => k + 1);
  }, [removeFromQueue]);

  // Cada tracking registrado pasa primero por la revisión; etiquetas y códigos no
  // registrados siguen el flujo normal de empaque.
  const handleDetected = useCallback(async (value) => {
    refreshIfStale();
    const raw = String(value || '').trim();
    if (!raw) return;
    if (review) { toast.info('Termina la revisión del paquete en curso'); return; }
    const isLabel = /-(B|C|L)\d+$/i.test(raw);
    let pkg = isLabel ? null : await findPackageByTracking(raw).catch(() => null);
    // El paquete puede no estar aún en la copia local: se busca en el servidor
    // para que la revisión no se salte.
    if (!pkg && !isLabel) {
      const rows = await base44.entities.Package.filter({ tracking_number: raw }, '-created_date', 1).catch(() => []);
      pkg = rows?.[0] || null;
    }
    if (!pkg) {
      const unit = await pack.handleScan(raw);
      if (unit && !unit.is_caja) await pack.closeUnit();
      return;
    }
    const client = pkg.client_email ? await getClientByEmail(pkg.client_email).catch(() => null) : null;
    setReview({ code: raw, pkg, client });
  }, [review, refreshIfStale, pack, getClientByEmail]);

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
            <ScanLine className="h-6 w-6 text-blue-600" /> Mesa de empaque
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
            {downloading && (
              <p className="text-xs text-slate-500">Descargando datos del almacén…</p>
            )}
            <Button onClick={refreshCache} variant="outline" className="w-full">
              <RefreshCw className="h-4 w-4" /> Reintentar descarga
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeUnit = pack.activeUnit;
  const activeLabel = activeUnit
    ? `${activeUnit.label_code} · ${activeUnit.client_snapshot?.full_name || activeUnit.client_email}`
    : '';

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ScanLine className="h-6 w-6 text-blue-600" /> Mesa de empaque
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Escanea el tracking o la etiqueta: el paquete se marca como recibido y entra en la unidad
          que elijas (bulto suelto o caja consolidada). Al cerrar la unidad, queda lista para
          despachar en la pantalla de Despacho.
        </p>
      </div>

      <PackStatusBar
        isOnline={isOnline}
        lastSync={lastSync}
        numberBlock={numberBlock}
        reservingBlock={reservingBlock}
        pendingCount={pendingBultos.length}
        isSyncing={isSyncing}
        sharedPending={shared.pending}
        sharedSyncing={shared.syncing}
      />

      <PackDestinationSelector
        value={pack.destination}
        onChange={pack.changeDestination}
        activeLabel={activeLabel}
      />

      <BarcodeScannerModule
        title="Recepción y empaque"
        description="Se leen códigos QR y códigos de barras, con la cámara o la lectora."
        placeholder="Tracking, etiqueta, bulto (-B##) o caja (-C##)"
        actionLabel="Agregar"
        value={code}
        onValueChange={setCode}
        onDetected={handleDetected}
        onPhotoCaptured={handlePhotoCaptured}
        continuous={true}
      />

      {review && (
        <PackageReviewPanel
          key={review.code}
          review={review}
          unitLabel={activeUnit && activeUnit.client_email === review.pkg?.client_email ? activeUnit.label_code : ''}
          client={review.client}
          onCancel={() => setReview(null)}
          onDone={async (withIncident, summary) => {
            const value = review.code;
            setReview(null);
            setLastReview(summary);
            toast.success(withIncident ? 'Incidencia guardada. Paquete empacado.' : 'Revisión guardada. Paquete empacado.');
            const unit = await pack.handleScan(value);
            // Bulto suelto revisado: se cierra solo para que pase al historial y a la
            // cola de impresión. Las cajas siguen abiertas para seguir consolidando.
            if (unit && !unit.is_caja) await pack.closeUnit();
          }}
        />
      )}

      <ReviewQueueCard items={reviewQueue.items} onRetry={reviewQueue.retry} />

      {pack.error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {pack.error}
        </p>
      )}

      {/* Fotos de escaneo que no subieron */}
      {failedPhotos.length > 0 && (
        <ScanPhotoFailureNotice
          codes={failedPhotos.map((f) => f.code)}
          retrying={photoRetrying}
          onRetry={handleRetryFailedPhotos}
          onSkip={() => setFailedPhotos([])}
          skipLabel="Continuar sin esas fotos"
          description="Esas fotos no se guardaron en el paquete. Reintenta la subida o continúa sin ellas (el paquete ya quedó en la unidad)."
        />
      )}

      {/* Código escaneado que no está registrado */}
      <PendingScanCodeCard
        code={pack.pendingCode?.code}
        reason={pack.pendingCode?.reason}
        hasUnit={!!activeUnit}
        busy={pack.busy}
        onAddUnregistered={async () => {
          // Un bulto suelto lleva siempre un solo paquete: se cierra solo.
          const unit = await pack.confirmUnregistered();
          if (unit && !unit.is_caja) await pack.closeUnit();
        }}
        onAssign={pack.startManualAssign}
        onDiscard={pack.discardPendingCode}
      />

      {/* Panel de asignación manual (paquete no registrado que se asigna a un cliente) */}
      {pack.manualAssign && (
        <ManualPackageAssign
          tracking={pack.manualAssign.tracking}
          onAssigned={async (client) => {
            const unit = await pack.handleManualAssign(client);
            if (unit && !unit.is_caja) await pack.closeUnit();
          }}
          onCancel={pack.cancelManualAssign}
        />
      )}

      {/* Cliente de la unidad cuando el shipping mark del código no se reconoció */}
      {pack.clientPrompt && (
        <ScanClientPicker
          candidateClient={pack.clientPrompt.client}
          selectedClient={null}
          deviceId={pack.deviceId}
          onSelect={pack.openForClient}
        />
      )}

      {/* Unidad activa: bulto suelto o caja consolidada */}
      {activeUnit?.is_caja ? (
        <CajaActiveCard
          caja={activeUnit}
          contents={pack.contents}
          onClose={pack.closeUnit}
          onUndoLast={pack.removeLast}
          onRemoveUnregistered={pack.removeUnregistered}
          busy={pack.busy}
        />
      ) : activeUnit ? (
        <OpenBultoCard
          bulto={activeUnit}
          onClose={(orders) => pack.closeUnit(orders)}
          onRemoveLast={pack.removeLast}
          onOrderChange={pack.saveOrder}
        />
      ) : null}

      <PackUnitChips
        units={pack.units}
        activeId={pack.activeUnitId}
        onSelect={pack.selectUnit}
      />

      {/* Cajas del cliente que esperan etiqueta continua y despacho */}
      <CajaLotList cajas={cajas} onPrintLabels={() => setLabelsOpen(true)} />

      <CajaLabelsDialog
        open={labelsOpen}
        onOpenChange={(value) => { setLabelsOpen(value); if (!value) setAutoPrintLabels(false); }}
        autoPrint={autoPrintLabels}
        onAutoPrinted={() => setAutoPrintLabels(false)}
        clientEmail={lotEmail}
        onPrinted={() => setLotKey((key) => key + 1)}
      />

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

      {/* Resultado del último escaneo (instantáneo, local) */}
      {pack.lastScan?.pkg && (
        <OfflineScanResult
          scanResult={pack.lastScan}
          client={pack.lastScan.client}
          isOnline={isOnline}
          review={lastReview && String(lastReview.tracking).toUpperCase() === String(pack.lastScan.pkg?.tracking_number || '').toUpperCase() ? lastReview : null}
        />
      )}

      {/* Cola de impresión persistente */}
      <PrintQueueCard
        queue={printQueue}
        onRemove={removeFromQueue}
        onClear={clearPrintQueue}
        onPrintedAll={removeFromQueueMany}
      />

      {/* Unidades pendientes de sincronizar */}
      <PackPendingSyncCard
        items={pendingBultos}
        isSyncing={isSyncing}
        isOnline={isOnline}
        onRetry={retrySync}
      />

      {/* Historial de bultos y cajas */}
      <Card>
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="w-full flex items-center justify-between gap-2 p-4 text-left"
        >
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-blue-600" />
            <div>
              <p className="font-semibold text-slate-800 text-sm">Historial de bultos y cajas</p>
              <p className="text-xs text-slate-500">Ver, reimprimir, editar o eliminar lo registrado</p>
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

      <AbsorbBultosConfirmDialog
        open={!!pack.absorbPending}
        sources={
          pack.absorbPending
            ? [{
                ...pack.absorbPending.source,
                package_count:
                  (pack.absorbPending.source.package_ids || []).length +
                  (pack.absorbPending.source.unregistered_codes || []).length,
                order_numbers: pack.absorbPending.source.cbm_order_numbers || [],
              }]
            : []
        }
        codes={pack.absorbPending ? [pack.absorbPending.code] : []}
        clientEmail={activeUnit?.client_email || ''}
        busy={pack.busy}
        onConfirm={pack.confirmAbsorb}
        onCancel={pack.cancelAbsorb}
      />
    </div>
  );
}