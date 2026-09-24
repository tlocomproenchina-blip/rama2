import React, { useState, useCallback } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, ScanLine, Truck, DoorOpen, User, Package as PackageIcon, Boxes,
  CheckCircle2, AlertTriangle, CloudOff, Cloud, RefreshCw, Clock, WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import BarcodeScannerModule from '@/components/warehouse/BarcodeScannerModule';
import QuickPreAlertForm from '@/components/admin/QuickPreAlertForm';
import RecentDispatchOrders from '@/components/warehouse/RecentDispatchOrders';
import DispatchApprovalModal from '@/components/warehouse/DispatchApprovalModal';
import { useOfflineWarehouseData } from '@/hooks/useOfflineWarehouseData';
import { useOfflineDispatchQueue } from '@/hooks/useOfflineDispatchQueue';
import { put as idbPut, getAll as idbGetAll, bulkPut as idbBulkPut } from '@/lib/offlineDb';

// Página offline-first: escanea tracking → lookup local instantáneo (IndexedDB)
// → muestra datos del cliente y paquete → botón "Aprobar salida de almacén"
// → al confirmar, marca despachado localmente y encola la salida para sincronizar
// en segundo plano. El backend notifica al cliente "Transportista asignado".
export default function WarehouseDispatch({ user }) {
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approving, setApproving] = useState(false);

  const {
    cacheReady, downloading, progress, lastSync, error: cacheError,
    refresh: refreshCache, findByLabelCode, findByTracking, getClientByEmail,
  } = useOfflineWarehouseData();

  const {
    pendingDispatches, isSyncing, isOnline, enqueueDispatch, enqueueBultoDispatch, retrySync,
  } = useOfflineDispatchQueue();

  // --- Despachar bulto completo: marcar todos los paquetes como despachado ---
  const handleBultoDispatch = useCallback(async (bulto) => {
    const packageIds = bulto.package_ids || [];
    const packageTrackings = bulto.package_trackings || [];
    const now = new Date().toISOString();

    // 0. Si el bulto es local (no sincronizado), sincronizarlo primero al servidor
    const isLocal = bulto.is_local || String(bulto.id || '').startsWith('local_');
    if (isLocal) {
      try {
        await base44.functions.invoke('syncBultoBatch', {
          local_bulto_id: bulto.id,
          label_code: bulto.label_code,
          client_email: bulto.client_email || '',
          shipping_mark: bulto.shipping_mark || '',
          bulto_number: bulto.bulto_number,
          total_bultos: bulto.total_bultos,
          package_ids: packageIds,
          package_trackings: packageTrackings,
          client_snapshot: bulto.client_snapshot || {},
          invoice_paid: bulto.invoice_paid || false,
          invoice_status: bulto.invoice_status || '',
          invoice_number: bulto.invoice_number || '',
          warehouse_id: bulto.warehouse_id || '',
          created_by: bulto.created_by || user?.email || '',
          closed_at: bulto.closed_at || now,
        });
      } catch (e) {
        console.error('Error sincronizando bulto local antes de despachar:', e);
      }
    }

    // 1. Marcar todos los paquetes como despachados localmente
    const localPackages = await idbGetAll('packages');
    const toUpdate = localPackages.filter((p) => packageIds.includes(p.id));
    const updatedPackages = toUpdate.map((p) => ({
      ...p,
      status: 'despachado',
      dispatched_date: now,
      dispatched_by: user?.email || '',
    }));
    if (updatedPackages.length) await idbBulkPut('packages', updatedPackages);

    // 2. Actualizar el bulto a despachado localmente
    const updatedBulto = { ...bulto, status: 'despachado' };
    await idbPut('bultos', updatedBulto);

    // 3. Encolar el despacho del bulto para sincronización
    await enqueueBultoDispatch({
      label_code: bulto.label_code,
      bulto_id: bulto.id,
      client_email: bulto.client_email || '',
      client_name: bulto.client_snapshot?.full_name || '',
      shipping_mark: bulto.shipping_mark || '',
      package_count: packageIds.length,
    });

    // 4. Mostrar resultado
    setLastResult({
      bulto: updatedBulto,
      package_count: packageIds.length,
      package_trackings: packageTrackings,
      client: bulto.client_snapshot || null,
      already_dispatched: false,
      is_bulto: true,
      offline: true,
    });

    toast.success(`Bulto ${bulto.label_code} despachado (${packageIds.length} paquetes). Notificando al cliente…`, { duration: 3000 });
  }, [user, enqueueBultoDispatch]);

  // --- Escaneo: lookup local instantáneo (IndexedDB) ---
  const handleScan = useCallback(async (tracking) => {
    const cleaned = (tracking || '').trim();
    if (!cleaned || scanning) return;
    setScanning(true);
    setCode('');
    try {
      // 0) Buscar si es un bulto por label_code (código -B##)
      const localBultos = await idbGetAll('bultos');
      const bulto = localBultos?.find((b) => b.label_code === cleaned);
      if (bulto && (bulto.package_ids || []).length > 0) {
        // Es un bulto local con paquetes: despachar todos
        await handleBultoDispatch(bulto);
        return;
      }

      // 0b) Si no está local pero parece un bulto (contiene -B), intentar en el servidor
      if (/-B\d+$/i.test(cleaned)) {
        try {
          const res = await base44.functions.invoke('dispatchBulto', { label_code: cleaned });
          const data = res?.data || res;
          if (data?.success && data?.bulto) {
            setLastResult({
              bulto: data.bulto,
              package_count: data.dispatched_packages || 0,
              package_trackings: [],
              client: null,
              already_dispatched: data.already_dispatched,
              is_bulto: true,
              offline: false,
            });
            toast.success(`Bulto ${cleaned} despachado (${data.dispatched_packages || 0} paquetes)`, { duration: 3000 });
            return;
          }
        } catch (_) {}
      }

      // 1) Buscar por label_code (código de etiqueta TLEC)
      let pkg = await findByLabelCode(cleaned);
      // 2) Buscar por tracking_number con sub-tracking
      if (!pkg) pkg = await findByTracking(cleaned);

      if (!pkg) {
        // No encontrado localmente: intentar en servidor como fallback
        try {
          const res = await base44.functions.invoke('scanDispatchPackage', {
            tracking_number: cleaned,
            action: 'lookup',
          });
          const data = res?.data || res;
          if (data?.package) {
            setLastResult(data);
            return;
          }
        } catch (_) {}
        // Tampoco en servidor: ofrecer pre-alerta manual
        setLastResult({ error: 'Paquete no encontrado', tracking: cleaned, not_found: true });
        return;
      }

      // Buscar cliente localmente
      const client = pkg.client_email ? await getClientByEmail(pkg.client_email) : null;
      const alreadyDispatched = pkg.status === 'despachado';

      setLastResult({
        package: pkg,
        client,
        already_dispatched: alreadyDispatched,
        is_received: pkg.status !== 'pre_alerta',
        auto_received: false,
        offline: true,
      });

      if (alreadyDispatched) {
        toast.info('Este paquete ya está despachado', { duration: 2000 });
      }
    } catch (e) {
      console.error('Scan error:', e);
      toast.error('Error al procesar el escaneo');
    } finally {
      setScanning(false);
    }
  }, [findByLabelCode, findByTracking, getClientByEmail, scanning]);

  // --- Aprobar salida de almacén ---
  const handleApproveExit = useCallback(async () => {
    const pkg = lastResult?.package;
    if (!pkg) return;
    setApproving(true);
    try {
      const now = new Date().toISOString();
      // 1. Marcar despachado localmente en IndexedDB
      const updatedPkg = {
        ...pkg,
        status: 'despachado',
        dispatched_date: now,
        dispatched_by: user?.email || '',
        ...(pkg.status === 'pre_alerta' ? { received_date: now, received_by: user?.email || '' } : {}),
      };
      await idbPut('packages', updatedPkg);

      // 2. Encolar la salida para sincronización en segundo plano
      await enqueueDispatch({
        tracking: pkg.tracking_number || pkg.label_code || '',
        package_id: pkg.id,
        photo_urls: [],
        client_email: pkg.client_email || '',
        client_name: lastResult?.client?.full_name || '',
        shipping_mark: pkg.shipping_mark || lastResult?.client?.shipping_mark || '',
      });

      // 3. Actualizar UI
      setLastResult((prev) => ({
        ...prev,
        package: updatedPkg,
        already_dispatched: true,
      }));

      toast.success('Salida de almacén aprobada. Notificando al cliente…', { duration: 2500 });
      setApprovalOpen(false);
    } catch (e) {
      console.error('Approve exit error:', e);
      toast.error('Error al aprobar la salida');
    } finally {
      setApproving(false);
    }
  }, [lastResult, user, enqueueDispatch]);

  // Indicador de caché
  if (!cacheReady && downloading) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Truck className="h-6 w-6 text-blue-600" /> Despacho por Escaneo
          </h1>
          <p className="text-sm text-slate-500 mt-1">Preparando caché offline…</p>
        </div>
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" /> {progress?.phase || 'Cargando…'}
            </div>
            <div className="text-xs text-slate-500">
              Clientes: {progress?.clients || 0} · Paquetes: {progress?.packages || 0}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Truck className="h-6 w-6 text-blue-600" /> Despacho por Escaneo
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Escanea el código del bulto (termina en -B##) para despachar todos sus paquetes a la vez,
          o escanea un tracking individual para despachar un solo paquete. El cliente recibe la notificación de transportista asignado.
        </p>
      </div>

      {/* Indicador de estado offline/online + caché */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline" className={isOnline ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-amber-200 text-amber-700 bg-amber-50'}>
          {isOnline ? <Cloud className="h-3 w-3 mr-1" /> : <CloudOff className="h-3 w-3 mr-1" />}
          {isOnline ? 'En línea' : 'Sin conexión'}
        </Badge>
        {cacheReady && (
          <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Caché lista
          </Badge>
        )}
        {pendingDispatches.length > 0 && (
          <Badge variant="outline" className="border-amber-300 text-amber-800 bg-amber-50">
            <Clock className="h-3 w-3 mr-1" /> {pendingDispatches.length} pendiente(s) de sincronizar
          </Badge>
        )}
        {isSyncing && (
          <Badge variant="outline" className="border-slate-200 text-slate-600 bg-slate-50">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Sincronizando…
          </Badge>
        )}
        <Button variant="ghost" size="sm" onClick={refreshCache} className="text-xs h-7">
          <RefreshCw className="h-3 w-3 mr-1" /> Refrescar caché
        </Button>
      </div>

      {/* Cola de salidas pendientes de sincronizar */}
      {pendingDispatches.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                <WifiOff className="h-3.5 w-3.5" /> Salidas pendientes de sincronizar
              </p>
              {!isSyncing && (
                <Button variant="outline" size="sm" onClick={retrySync} className="text-xs h-7">
                  Reintentar
                </Button>
              )}
            </div>
            <div className="space-y-1">
              {pendingDispatches.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs bg-white/70 rounded px-2 py-1.5 border border-amber-200/60">
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-slate-700 truncate">{item.tracking || '(sin tracking)'}</p>
                    <p className="text-slate-500 truncate">{item.client_name || item.client_email}</p>
                  </div>
                  <Badge variant="outline" className={
                    item.sync_status === 'syncing' ? 'border-blue-200 text-blue-700 bg-blue-50' :
                    item.sync_status === 'error' ? 'border-rose-200 text-rose-700 bg-rose-50' :
                    'border-amber-200 text-amber-700 bg-amber-50'
                  }>
                    {item.sync_status === 'syncing' ? 'Sincronizando' :
                     item.sync_status === 'error' ? 'Error' : 'Pendiente'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <BarcodeScannerModule
        title="Escaneo de despacho"
        description="Escanea el código del bulto (-B##) para despachar todo, o el tracking/etiqueta de un paquete individual."
        placeholder="Escanea bulto (-B##) o tracking individual"
        actionLabel="Buscar"
        value={code}
        onValueChange={setCode}
        onDetected={handleScan}
        continuous={true}
      />

      {scanning && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Buscando paquete…
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resultado del escaneo */}
      {lastResult && !lastResult.error && (
        lastResult.is_bulto ? (
          <BultoDispatchResultCard result={lastResult} />
        ) : (
          <ScanResultCard
            result={lastResult}
            onApproveExit={() => setApprovalOpen(true)}
          />
        )
      )}

      {lastResult?.error && (
        <Card className="border-rose-300 bg-rose-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-rose-600 shrink-0" />
            <div>
              <p className="font-semibold text-rose-700">Tracking: {lastResult.tracking}</p>
              <p className="text-sm text-rose-600">{lastResult.error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {lastResult?.not_found && lastResult?.tracking && (
        <QuickPreAlertForm
          trackingNumber={lastResult.tracking}
          onCreated={() => handleScan(lastResult.tracking)}
          onCancel={() => setLastResult(null)}
        />
      )}

      {!lastResult && !scanning && (
        <div className="text-center py-10 text-slate-400">
          <ScanLine className="h-10 w-10 mx-auto mb-2" />
          <p className="text-sm">Aún no has escaneado ningún paquete en esta sesión.</p>
        </div>
      )}

      <RecentDispatchOrders />

      {/* Modal de aprobación de salida de almacén */}
      <DispatchApprovalModal
        open={approvalOpen}
        onOpenChange={setApprovalOpen}
        packageData={lastResult?.package}
        client={lastResult?.client}
        onConfirm={handleApproveExit}
        processing={approving}
      />
    </div>
  );
}

// Tarjeta de resultado del despacho de bulto completo
function BultoDispatchResultCard({ result }) {
  if (!result?.bulto) return null;
  const bulto = result.bulto;
  const cs = bulto.client_snapshot || {};
  const clientName = cs.full_name || bulto.client_email || 'Cliente';
  const mark = bulto.shipping_mark || cs.shipping_mark;
  const trackings = result.package_trackings || [];

  return (
    <Card className="border-emerald-300 bg-emerald-50">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <Truck className="h-8 w-8 text-emerald-600 shrink-0" />
            <div>
              <p className="text-lg font-bold text-slate-800">{clientName}</p>
              {mark && <p className="font-mono text-sm font-semibold text-blue-700">Mark: {mark}</p>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge className="bg-emerald-600 text-white">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Bulto despachado
            </Badge>
            {result.offline && (
              <Badge variant="outline" className="border-slate-300 text-slate-600 bg-white/70">
                Procesado offline
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <Boxes className="h-4 w-4 shrink-0" />
          <span className="font-mono font-semibold break-all">{bulto.label_code}</span>
          <span className="text-slate-400">·</span>
          <span>{result.package_count} paquete{result.package_count !== 1 ? 's' : ''}</span>
        </div>
        {trackings.length > 0 && (
          <div className="rounded-lg border border-emerald-200 bg-white/70 p-2 max-h-28 overflow-y-auto">
            <ul className="space-y-1">
              {trackings.map((t, i) => (
                <li key={`${t}-${i}`} className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 font-mono w-5 text-right">{i + 1}.</span>
                  <span className="font-mono text-slate-700 break-all">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex items-center gap-2 rounded-lg bg-emerald-100 border border-emerald-300 px-3 py-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-800">
            Todos los paquetes del bulto fueron despachados. El cliente recibirá la notificación de transportista asignado.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Tarjeta de resultado del escaneo con botón "Aprobar salida de almacén"
function ScanResultCard({ result, onApproveExit }) {
  if (!result?.package) return null;
  const pkg = result.package;
  const client = result.client;
  const clientName = client?.full_name || pkg.client_email || 'Cliente';
  const mark = pkg.shipping_mark || client?.shipping_mark;

  return (
    <Card className={result.already_dispatched ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50'}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <User className="h-8 w-8 text-slate-700 shrink-0" />
            <div>
              <p className="text-lg font-bold text-slate-800 break-all">{clientName}</p>
              {mark && <p className="font-mono text-sm font-semibold text-blue-700">Mark: {mark}</p>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {result.already_dispatched ? (
              <Badge className="bg-amber-500 text-white">Despachado</Badge>
            ) : result.is_received ? (
              <Badge className="bg-blue-600 text-white">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Recibido
              </Badge>
            ) : (
              <Badge className="bg-slate-500 text-white">Pre-alerta (sin recibir)</Badge>
            )}
            {result.offline && (
              <Badge variant="outline" className="border-slate-300 text-slate-600 bg-white/70">
                Buscado offline
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <PackageIcon className="h-4 w-4 shrink-0" />
          <span className="font-mono break-all">{pkg.tracking_number || pkg.label_code || '(sin tracking)'}</span>
          {pkg.description && (
            <>
              <span className="text-slate-400">·</span>
              <span className="truncate">{pkg.description}</span>
            </>
          )}
        </div>

        {!result.already_dispatched && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={onApproveExit} className="bg-blue-600 hover:bg-blue-700">
              <DoorOpen className="h-4 w-4 mr-2" />
              Aprobar salida de almacén
            </Button>
          </div>
        )}
        {result.already_dispatched && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-100 border border-amber-300 px-3 py-2">
            <CheckCircle2 className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              Este paquete ya fue despachado. El cliente ya fue notificado.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}