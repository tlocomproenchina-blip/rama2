import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ScanLine, Boxes, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import BarcodeScannerModule from '@/components/warehouse/BarcodeScannerModule';
import BluetoothPrinter from '@/components/warehouse/BluetoothPrinter';
import useScannedPhotoUploader from '@/hooks/useScannedPhotoUploader';
import useWarehouseAccess from '@/hooks/useWarehouseAccess';
import OpenBultoCard from '@/components/warehouse/OpenBultoCard';
import OpenBultosChips from '@/components/warehouse/OpenBultosChips';
import BultoHistory from '@/components/warehouse/BultoHistory';
import { History, ChevronDown, ChevronUp } from 'lucide-react';

// Página unificada: escanea tracking → marca recibido + crea orden de despacho
// + agrega el paquete al bulto abierto del cliente (uno por cliente en paralelo).
// Al cerrar un bulto se imprime la etiqueta térmica por Bluetooth.
export default function WarehouseScanPack({ user }) {
  const { allowed, loading: loadingAccess } = useWarehouseAccess(user, 'WarehouseScanPack');
  const [code, setCode] = useState('');
  const [processing, setProcessing] = useState(false);
  const [openBultos, setOpenBultos] = useState([]);
  const [activeBultoId, setActiveBultoId] = useState(null);
  const [lastScan, setLastScan] = useState(null);
  const [closingBulto, setClosingBulto] = useState(null);
  const [loadingOpen, setLoadingOpen] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const pendingOrderRef = useRef(new Map());
  const openBultosRef = useRef([]);
  const bultoLocksRef = useRef(new Map());
  const { handlePhotoCaptured, waitForPhoto } = useScannedPhotoUploader();

  // Helper: actualiza la ref y el estado sincrónicamente para evitar closures stale
  const updateBultosState = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(openBultosRef.current) : updater;
    openBultosRef.current = next;
    setOpenBultos(next);
  }, []);

  // Cargar bultos abiertos (estado 'activo') al montar para reanudar trabajo interrumpido
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

  // Crea/actualiza la orden de despacho del cliente en segundo plano (igual que WarehouseDispatch)
  const autoGenerateOrder = useCallback(async (scanData) => {
    try {
      const pkg = scanData?.package;
      const client = scanData?.client;
      if (!pkg?.tracking_number || !pkg?.client_email) return;
      if (pendingOrderRef.current.has(pkg.tracking_number)) return;
      pendingOrderRef.current.set(pkg.tracking_number, true);

      const payload = {
        client_email: pkg.client_email,
        client_name: client?.full_name || pkg.client_email,
        shipping_mark: pkg.shipping_mark || client?.shipping_mark || '',
        client_snapshot: {
          full_name: client?.full_name || '',
          email: client?.email || pkg.client_email,
          cedula: client?.cedula || '',
          whatsapp: client?.whatsapp || '',
          address: client?.address || '',
          city: client?.city || '',
          state: client?.state || '',
          shipping_mark: client?.shipping_mark || '',
        },
        items: [{
          tracking_number: pkg.tracking_number,
          description: pkg.description || '',
          consolidation_tracking: pkg.consolidation_tracking || '',
        }],
      };

      const res = await base44.functions.invoke('createDispatchOrder', payload);
      const orderData = res?.data?.order;
      const wasUpdated = res?.data?.updated;
      const noChange = res?.data?.no_change;
      if (!orderData) return;
      if (!noChange && wasUpdated) toast.success(`Orden ${orderData.order_number} actualizada (+1 paquete)`);
      else if (!noChange) toast.success(`Orden ${orderData.order_number} creada automáticamente`);
    } catch (_) {
      // silencioso: la orden es secundaria al empaque
    } finally {
      pendingOrderRef.current.delete(scanData?.package?.tracking_number);
    }
  }, []);

  // Agrega el paquete al bulto abierto del cliente; si no tiene, crea uno nuevo.
  // Usa openBultosRef (siempre actualizado) + candado por cliente para serializar
  // escaneos rápidos del mismo cliente y evitar crear bultos duplicados.
  const addPackageToBulto = useCallback(async (pkg, client) => {
    if (!pkg?.id || !pkg?.client_email) return;
    const clientEmail = pkg.client_email;

    // Candado por cliente: serializa operaciones concurrentes del mismo cliente
    const prevLock = bultoLocksRef.current.get(clientEmail) || Promise.resolve();
    const currentOp = prevLock.then(async () => {
      const existing = openBultosRef.current.find((b) => b.client_email === clientEmail);
      try {
        if (existing) {
          const newIds = [...(existing.package_ids || []), pkg.id];
          const res = await base44.functions.invoke('updateBulto', {
            bulto_id: existing.id,
            package_ids: newIds,
          });
          const updated = res?.data?.bulto || {
            ...existing,
            package_ids: newIds,
            package_trackings: [...(existing.package_trackings || []), pkg.tracking_number].filter(Boolean),
          };
          updateBultosState((prev) => prev.map((b) => (b.id === existing.id ? updated : b)));
          setActiveBultoId(existing.id);
        } else {
          const res = await base44.functions.invoke('createBulto', { package_ids: [pkg.id] });
          const data = res?.data;
          const newBulto = data?.bulto || {
            id: data?.id,
            label_code: data?.label_code,
            bulto_number: data?.bulto_number,
            total_bultos: data?.total_bultos,
            client_email: clientEmail,
            shipping_mark: pkg.shipping_mark || client?.shipping_mark || '',
            package_ids: [pkg.id],
            package_trackings: [pkg.tracking_number].filter(Boolean),
            client_snapshot: data?.client_snapshot || {},
            invoice_paid: data?.invoice_paid,
            status: 'activo',
          };
          updateBultosState((prev) => [...prev, newBulto]);
          setActiveBultoId(newBulto.id);
        }
      } catch (_) {
        toast.error('Error al agregar paquete al bulto');
      }
    });
    bultoLocksRef.current.set(clientEmail, currentOp);
    await currentOp;
    if (bultoLocksRef.current.get(clientEmail) === currentOp) {
      bultoLocksRef.current.delete(clientEmail);
    }
  }, [updateBultosState]);

  const runScan = useCallback(async (tracking, action) => {
    const cleaned = (tracking || '').trim();
    if (!cleaned || processing) return;
    setProcessing(true);
    if (action === 'lookup') setCode('');
    try {
      let photoUrl = null;
      if (action !== 'lookup') photoUrl = await waitForPhoto(cleaned);
      const payload = { tracking_number: cleaned, action };
      if (photoUrl) {
        payload.package_image_url = photoUrl;
        payload.package_image_urls = [photoUrl];
      }
      const response = await base44.functions.invoke('scanDispatchPackage', payload);
      const data = response?.data || response;
      setLastScan(data);
      if (data?.package?.id) {
        if (action === 'lookup' && !data.already_dispatched) autoGenerateOrder(data);
        if (data.package.client_email) addPackageToBulto(data.package, data.client);
      }
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || 'Error al procesar el escaneo';
      setLastScan({ error: message, tracking: cleaned, not_found: error?.response?.status === 404 });
    } finally {
      setProcessing(false);
    }
  }, [processing, autoGenerateOrder, addPackageToBulto, waitForPhoto]);

  const handleScan = useCallback((tracking) => runScan(tracking, 'lookup'), [runScan]);

  // Cierra el bulto: pasa a 'despachado' y se prepara para imprimir la etiqueta
  const handleCloseBulto = useCallback(async (bulto) => {
    try {
      await base44.functions.invoke('updateBulto', { bulto_id: bulto.id, status: 'despachado' });
      updateBultosState((prev) => {
        const remaining = prev.filter((b) => b.id !== bulto.id);
        setActiveBultoId((curr) => (curr === bulto.id ? (remaining[0]?.id || null) : curr));
        return remaining;
      });
      setClosingBulto({ ...bulto, status: 'despachado' });
      toast.success(`Bulto ${bulto.bulto_number}/${bulto.total_bultos} cerrado`);
      setHistoryRefreshKey((k) => k + 1);
    } catch (_) {
      toast.error('Error al cerrar el bulto');
    }
  }, [updateBultosState]);

  // Quita el último paquete agregado al bulto; si queda vacío, lo elimina
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

  const activeBulto = useMemo(
    () => openBultos.find((b) => b.id === activeBultoId),
    [openBultos, activeBultoId]
  );

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
          Escanea el tracking: se marca recibido, se crea la orden de despacho y se agrega al bulto abierto del cliente automáticamente. Un bulto abierto por cliente en paralelo.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <p className="text-sm">Cierra la app de la impresora antes de imprimir por Bluetooth para evitar conflictos de conexión.</p>
      </div>

      <BarcodeScannerModule
        title="Escaneo de despacho y empaque"
        description="Usa la cámara, una lectora USB o escribe el tracking. La cámara captura una foto automática del paquete al detectar el código."
        placeholder="Escanea o escribe el tracking"
        actionLabel="Buscar"
        value={code}
        onValueChange={setCode}
        onDetected={handleScan}
        onPhotoCaptured={handlePhotoCaptured}
        continuous={true}
      />

      {processing && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Procesando escaneo...
            </div>
          </CardContent>
        </Card>
      )}

      {lastScan?.error && (
        <Card className="border-red-200">
          <CardContent className="p-4 text-sm text-red-700">
            {lastScan.error} {lastScan.tracking && <span className="font-mono">({lastScan.tracking})</span>}
          </CardContent>
        </Card>
      )}

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
            {lastScan.auto_received && <p className="text-xs text-blue-600">Marcado como recibido automáticamente</p>}
          </CardContent>
        </Card>
      )}

      {activeBulto ? (
        <OpenBultoCard
          bulto={activeBulto}
          onClose={() => handleCloseBulto(activeBulto)}
          onRemoveLast={() => handleRemoveLast(activeBulto)}
        />
      ) : (
        !processing && (
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