import React, { useState, useCallback } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ScanLine, Truck } from 'lucide-react';
import BarcodeScannerModule from '@/components/warehouse/BarcodeScannerModule';
import DispatchResultCard from '@/components/warehouse/DispatchResultCard';
import QuickPreAlertForm from '@/components/admin/QuickPreAlertForm';
import DispatchGroupedList from '@/components/warehouse/DispatchGroupedList';
import RecentDispatchOrders from '@/components/warehouse/RecentDispatchOrders';

export default function WarehouseDispatch() {
  const [code, setCode] = useState('');
  const [processing, setProcessing] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [scans, setScans] = useState([]);
  const [ordersKey, setOrdersKey] = useState(0);

  const runScan = useCallback(async (tracking, action) => {
    const cleaned = (tracking || '').trim();
    if (!cleaned || processing) return;
    setProcessing(true);
    if (action === 'lookup') setCode('');
    try {
      const response = await base44.functions.invoke('scanDispatchPackage', { tracking_number: cleaned, action });
      const data = response?.data || response;
      setLastResult(data);
      if (data?.package?.tracking_number) {
        setScans((prev) => [
          data,
          ...prev.filter((s) => s?.package?.tracking_number !== data.package.tracking_number)
        ]);
      }
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || 'Error al procesar el escaneo';
      const notFound = error?.response?.status === 404 || error?.response?.data?.not_found;
      setLastResult({ error: message, tracking: cleaned, not_found: !!notFound });
    } finally {
      setProcessing(false);
    }
  }, [processing]);

  const handleScan = useCallback((tracking) => runScan(tracking, 'lookup'), [runScan]);
  const handleMarkReceived = useCallback((tracking) => runScan(tracking, 'receive'), [runScan]);
  const handleMarkDispatched = useCallback((tracking) => runScan(tracking, 'dispatch'), [runScan]);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Truck className="h-6 w-6 text-blue-600" /> Despacho por Escaneo
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Escanea el tracking del paquete físico: verás de qué cliente es para agruparlo y quedará marcado como despachado.
          Si no estaba recibido, se registra como recibido automáticamente.
        </p>
      </div>

      <BarcodeScannerModule
        title="Escaneo de despacho"
        description="Usa la cámara, una lectora USB o escribe el tracking para despachar."
        placeholder="Escanea o escribe el tracking"
        actionLabel="Buscar"
        value={code}
        onValueChange={setCode}
        onDetected={handleScan}
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

      <DispatchResultCard
        result={lastResult}
        processing={processing}
        onMarkReceived={handleMarkReceived}
        onMarkDispatched={handleMarkDispatched}
      />

      {lastResult?.not_found && lastResult?.tracking && (
        <QuickPreAlertForm
          trackingNumber={lastResult.tracking}
          onCreated={() => handleScan(lastResult.tracking)}
          onCancel={() => setLastResult(null)}
        />
      )}

      {scans.length === 0 && !lastResult && (
        <div className="text-center py-10 text-slate-400">
          <ScanLine className="h-10 w-10 mx-auto mb-2" />
          <p className="text-sm">Aún no has escaneado ningún paquete en esta sesión.</p>
        </div>
      )}

      <DispatchGroupedList scans={scans} onOrderCreated={() => setOrdersKey((k) => k + 1)} />

      <RecentDispatchOrders key={ordersKey} />
    </div>
  );
}