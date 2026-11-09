import React, { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CloudUpload, History, Layers, Loader2, Printer, RefreshCw, ScanLine } from 'lucide-react';
import TaskTabs from '@/components/common/TaskTabs';
import TaskPanel from '@/components/common/TaskPanel';
import EmptyTaskState from '@/components/common/EmptyTaskState';
import useTaskTab from '@/hooks/useTaskTab';
import PrintQueueShortcut from '@/components/warehouse/PrintQueueShortcut';
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
import OfflineScanResult from '@/components/warehouse/OfflineScanResult';
import PrintQueueCard from '@/components/warehouse/PrintQueueCard';
import ConnectedSharedPrintQueue from '@/components/warehouse/print-queue/ConnectedSharedPrintQueue';
import { usePrintQueue } from '@/hooks/usePrintQueue';
import { useOfflineWarehouseData } from '@/hooks/useOfflineWarehouseData';
import { useBultoNumberBlock } from '@/hooks/useBultoNumberBlock';
import { useOfflineBultoSync } from '@/hooks/useOfflineBultoSync';
import usePackUnit from '@/hooks/usePackUnit';
import { localCajasOfClient } from '@/lib/cajaLocal';
import { del, put, bulkPut, findPackageByTracking } from '@/lib/offlineDb';
import PackageReviewPanel from '@/components/warehouse/PackageReviewPanel';
import ReviewQueueCard from '@/components/warehouse/ReviewQueueCard';
import useReviewQueue from '@/hooks/useReviewQueue';
import useSharedPackUnits from '@/hooks/useSharedPackUnits';
import DuplicateTrackingAlert from '@/components/warehouse/DuplicateTrackingAlert';
import { describeOwner, findLocalTrackingOwner } from '@/lib/trackingDuplicates';

// Tope para buscar en el servidor un paquete que aún no está en la copia del dispositivo.
const SERVER_LOOKUP_MS = 2500;

// Mesa única de empaque (offline-first): un solo escáner recibe el paquete y lo deja en la
// unidad del cliente que indique el selector (bulto suelto o caja consolidada). La unidad
// que el cliente ya tenía abierta se retoma sola, y el cierre de cada tipo mantiene su
// operativa: etiqueta individual del bulto o tira continua de etiquetas de la caja.
export default function WarehouseScanPack({ user }) {
  const { allowed, loading: loadingAccess } = useWarehouseAccess(user, 'WarehouseScanPack');
  const [code, setCode] = useState('');
  const [tab, setTab] = useTaskTab(['empacar', 'etiquetas', 'lote', 'sincronizar', 'historial']);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [cajaRefreshKey, setCajaRefreshKey] = useState(0);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [autoPrintLabels, setAutoPrintLabels] = useState(false);
  const [lotKey, setLotKey] = useState(0);
  const [lotEmail, setLotEmail] = useState('');
  const [cajas, setCajas] = useState([]);
  const [review, setReview] = useState(null);
  const [lastReview, setLastReview] = useState(null);
  const reviewQueue = useReviewQueue();

  // Trackings que ya estaban en otra caja o bulto: aviso rojo + vibración, sin agregarlos.
  const [duplicates, setDuplicates] = useState([]);
  const reportDuplicate = useCallback((found) => {
    const list = (Array.isArray(found) ? found : [found]).filter(Boolean);
    if (!list.length) return;
    const at = Date.now();
    setDuplicates((prev) => [...list.map((d) => ({ ...d, at })), ...prev].slice(0, 5));
    toast.error(`${list[0].code} ${describeOwner(list[0])}`, { duration: 6000 });
    try { navigator.vibrate?.([200, 100, 200]); } catch (_) {}
  }, []);

  // Foto tomada por el escáner al leer el código: se guarda en memoria hasta que el
  // paquete entra en la unidad y ahí pasa a la cola del dispositivo (no se pierde aunque
  // no haya conexión ni se recargue la pantalla).
  const photoStashRef = useRef(new Map());
  const handlePhotoCaptured = useCallback((scannedCode, base64) => {
    if (!scannedCode || !base64) return;
    const stash = photoStashRef.current;
    stash.set(scannedCode, base64);
    if (stash.size > 20) stash.delete(stash.keys().next().value);
  }, []);

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
    pendingBultos, isSyncing, isOnline, enqueueClosedBulto, enqueueCaja, enqueuePackageReception,
    enqueueScanPhoto, enqueuePrintLogs, enqueueCajaLabels, retrySync,
  } = useOfflineBultoSync({
    // El servidor le dio otro código al bulto: se reimprime con el código nuevo.
    onRelabeled: (bulto) => { enqueuePrint(bulto); setHistoryRefreshKey((k) => k + 1); },
    // Trackings que ya había registrado otro operador: el servidor los omite y sigue.
    onDuplicate: () => setHistoryRefreshKey((k) => k + 1),
  });

  // La foto del escaneo pasa a la cola del dispositivo y se sube sola al haber conexión.
  const captureScanPhoto = useCallback(async (scannedCode, pkg) => {
    const base64 = photoStashRef.current.get(scannedCode);
    if (!base64) return;
    photoStashRef.current.delete(scannedCode);
    await enqueueScanPhoto({ pkg, base64 });
  }, [enqueueScanPhoto]);

  // Cajas y bultos que arma este operador, guardados en línea (los recupera en otro equipo).
  const packRef = useRef(null);
  const shared = useSharedPackUnits({
    owner: user?.email || '',
    onRemoteChange: () => packRef.current?.reloadUnits(),
    onDuplicate: () => {},
  });

  // Bultos creados o modificados en otros dispositivos: refresca el historial al instante.
  useEffect(() => {
    let timer = null;
    const unsubscribe = base44.entities.Bulto.subscribe((event) => {
      // Cada unidad registrada entra al caché del dispositivo: así el lote de cajas se ve al
      // instante y un tracking ya registrado se detecta sin esperar al servidor.
      if (event?.data || event?.type === 'delete') {
        const op = event.type === 'delete' ? del('bultos', event.id) : put('bultos', event.data);
        op.catch(() => {}).finally(() => setCajaRefreshKey((k) => k + 1));
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        try { base44.invalidateEntityCache?.('Bulto'); } catch (_) {}
        setHistoryRefreshKey((k) => k + 1);
      }, 400);
    });
    return () => { clearTimeout(timer); unsubscribe?.(); };
  }, []);

  const [manualRefreshing, setManualRefreshing] = useState(false);
  const manualRefresh = async () => {
    setManualRefreshing(true);
    try {
      try { base44.invalidateEntityCache?.('Bulto'); } catch (_) {}
      await shared.pullAll();
      await packRef.current?.reloadUnits?.();
      if (lotEmail) {
        const serverCajas = await base44.entities.Bulto.filter({ client_email: lotEmail, is_caja: true }, '-created_date', 200).catch(() => []);
        await bulkPut('bultos', serverCajas).catch(() => {});
        setCajaRefreshKey((k) => k + 1);
      }
      setHistoryRefreshKey((k) => k + 1);
    } finally {
      setManualRefreshing(false);
    }
  };

  const pack = usePackUnit({
    user,
    onUnitChange: shared.pushChange,
    onUnitRemoved: shared.pushStatus,
    onDuplicate: reportDuplicate,
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

  // Unidades abiertas del operador: primero las del dispositivo (instantáneo) y luego las
  // que dejó guardadas en línea. El caché del almacén ya se refresca solo al abrir la
  // pantalla, así que aquí no se vuelve a descargar.
  useEffect(() => {
    if (!cacheReady) return undefined;
    let cancelled = false;
    (async () => {
      await pack.reloadUnits();
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
  }, [lotEmail, lotKey, pendingBultos.length, cajaRefreshKey]);

  // Al cerrar la caja se imprime de inmediato la tira de etiquetas del lote, con o sin
  // conexión: el registro en el servidor sigue en segundo plano.
  const closeCaja = useCallback(async () => {
    const closed = await pack.closeUnit();
    if (!closed?.client_email) return;
    setLotEmail(closed.client_email);
    setLotKey((k) => k + 1);
    setAutoPrintLabels(true);
    setLabelsOpen(true);
  }, [pack]);

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
  // registrados siguen el flujo normal de empaque. El escaneo nunca espera al servidor:
  // los duplicados se detectan al instante con lo que hay en el dispositivo y el servidor
  // omite al sincronizar los que haya registrado otro operador.
  const handleDetected = useCallback(async (value) => {
    const raw = String(value || '').trim();
    if (!raw) return;
    if (review) { toast.info('Termina la revisión del paquete en curso'); return; }
    const isLabel = /-(B|C|L)\d+$/i.test(raw);
    let pkg = isLabel ? null : await findPackageByTracking(raw).catch(() => null);
    if (!isLabel) {
      const local = await findLocalTrackingOwner({ code: pkg?.tracking_number || raw, packageId: pkg?.id, activeUnit: pack.activeUnit });
      if (local) { reportDuplicate(local); return; }
      // Paquete que aún no está en la copia local: se busca con un tope corto y solo con
      // conexión, para no frenar la mesa.
      if (!pkg && navigator.onLine) {
        const serverPkg = await Promise.race([
          base44.entities.Package.filter({ tracking_number: raw }, '-created_date', 1)
            .then((rows) => rows?.[0] || null).catch(() => null),
          new Promise((resolve) => setTimeout(() => resolve(null), SERVER_LOOKUP_MS)),
        ]);
        if (serverPkg) {
          pkg = serverPkg;
          await put('packages', serverPkg).catch(() => {});
        }
      }
    }
    if (!pkg) {
      const unit = await pack.handleScan(raw);
      if (unit && !unit.is_caja) await pack.closeUnit();
      return;
    }
    const client = pkg.client_email ? await getClientByEmail(pkg.client_email).catch(() => null) : null;
    setReview({ code: raw, pkg, client });
  }, [review, pack, getClientByEmail, reportDuplicate]);

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
          Escanea el tracking o la etiqueta y el paquete entra en el bulto o la caja que elijas.
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

      <TaskTabs
        idPrefix="pack"
        label="Tareas de la mesa de empaque"
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'empacar', label: 'Empacar', icon: ScanLine },
          { key: 'etiquetas', label: 'Etiquetas', icon: Printer, badge: printQueue.length },
          { key: 'lote', label: 'En lote', icon: Layers },
          { key: 'sincronizar', label: 'Sincronizar', icon: CloudUpload, badge: pendingBultos.length + reviewQueue.items.length },
          { key: 'historial', label: 'Historial', icon: History },
        ]}
      />

      <TaskPanel tab="empacar" active={tab} idPrefix="pack">
      <PrintQueueShortcut count={printQueue.length} onOpen={() => setTab('etiquetas')} />

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
            // Paquete manual: se crea y empaca igual que uno escaneado, tras su revisión.
            const unit = review.manual
              ? await pack.handleManualAssign(review.client, value)
              : await pack.handleScan(value);
            // Bulto suelto revisado: se cierra solo para que pase al historial y a la
            // cola de impresión. Las cajas siguen abiertas para seguir consolidando.
            if (unit && !unit.is_caja) await pack.closeUnit();
          }}
        />
      )}

      <DuplicateTrackingAlert items={duplicates} onDismiss={() => setDuplicates([])} />

      {pack.error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {pack.error}
        </p>
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
          onAssigned={(client) => {
            // Igual que un paquete escaneado: pasa por la revisión (foto, contenedor e
            // incidencia) antes de empacarse.
            const tracking = pack.manualAssign.tracking;
            pack.cancelManualAssign();
            setReview({
              code: tracking,
              manual: true,
              client,
              pkg: {
                tracking_number: tracking,
                client_email: client.email,
                shipping_mark: client.shipping_mark || '',
                description: '',
              },
            });
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
          onClose={closeCaja}
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

      {/* Resultado del último escaneo (instantáneo, local) */}
      {pack.lastScan?.pkg && (
        <OfflineScanResult
          scanResult={pack.lastScan}
          client={pack.lastScan.client}
          isOnline={isOnline}
          review={lastReview && String(lastReview.tracking).toUpperCase() === String(pack.lastScan.pkg?.tracking_number || '').toUpperCase() ? lastReview : null}
        />
      )}
      </TaskPanel>

      <TaskPanel tab="etiquetas" active={tab} idPrefix="pack">
        {/* Cola compartida: un teléfono es la estación e imprime para todos */}
        <ConnectedSharedPrintQueue />
        {/* Cola de impresión persistente */}
        <PrintQueueCard
          queue={printQueue}
          onRemove={removeFromQueue}
          onClear={clearPrintQueue}
          onPrintedAll={removeFromQueueMany}
          onLogPrints={enqueuePrintLogs}
        />
        {/* Cajas del cliente que esperan etiqueta continua y despacho */}
        <CajaLotList cajas={cajas} onPrintLabels={() => setLabelsOpen(true)} />
        {!printQueue.length && !cajas.length && (
          <EmptyTaskState
            icon={Printer}
            title="No hay etiquetas pendientes"
            description="Las unidades que cierres aparecerán aquí para imprimir su etiqueta."
          />
        )}
      </TaskPanel>

      <CajaLabelsDialog
        open={labelsOpen}
        onOpenChange={(value) => { setLabelsOpen(value); if (!value) setAutoPrintLabels(false); }}
        autoPrint={autoPrintLabels}
        onAutoPrinted={() => setAutoPrintLabels(false)}
        clientEmail={lotEmail}
        onAssigned={(list) => enqueueCajaLabels({ clientEmail: lotEmail, cajas: list })}
        onPrinted={() => setLotKey((key) => key + 1)}
      />

      <TaskPanel tab="lote" active={tab} idPrefix="pack">
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
      </TaskPanel>

      <TaskPanel tab="sincronizar" active={tab} idPrefix="pack">
        {/* Unidades pendientes de sincronizar */}
        <PackPendingSyncCard
          items={pendingBultos}
          isSyncing={isSyncing}
          isOnline={isOnline}
          onRetry={retrySync}
        />
        <ReviewQueueCard items={reviewQueue.items} onRetry={reviewQueue.retry} />
        {!pendingBultos.length && !reviewQueue.items.length && (
          <EmptyTaskState
            icon={CloudUpload}
            title="Todo sincronizado"
            description="No hay unidades ni revisiones esperando conexión."
          />
        )}
        <Button onClick={manualRefresh} disabled={manualRefreshing} variant="outline" className="w-full">
          <RefreshCw className={`h-4 w-4 ${manualRefreshing ? 'animate-spin' : ''}`} />
          {manualRefreshing ? 'Actualizando…' : 'Actualizar unidades y bultos'}
        </Button>
      </TaskPanel>

      <TaskPanel tab="historial" active={tab} idPrefix="pack">
        {/* Historial de bultos y cajas */}
        <Card>
          <CardContent className="space-y-3 p-4">
            <div>
              <p className="font-semibold text-slate-800 text-sm">Historial de bultos y cajas</p>
              <p className="text-xs text-slate-500">Ver, reimprimir, editar o eliminar lo registrado</p>
            </div>
            <BultoHistory refreshKey={historyRefreshKey} />
          </CardContent>
        </Card>
      </TaskPanel>

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