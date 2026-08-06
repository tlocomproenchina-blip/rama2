import React, { useState, useCallback, useRef } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ScanLine, Truck } from 'lucide-react';
import { toast } from 'sonner';
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
  const pendingOrderRef = useRef(new Map());

  const autoGenerateOrder = useCallback(async (scanData) => {
    try {
      const pkg = scanData?.package;
      const client = scanData?.client;
      if (!pkg?.tracking_number || !pkg?.client_email) return;

      // Evita llamadas duplicadas para el mismo tracking si ya hay una en vuelo
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

      if (noChange) {
        // Ya estaba en la orden, no notificar
      } else if (wasUpdated) {
        toast.success(`Orden ${orderData.order_number} actualizada (+1 paquete)`);
      } else {
        toast.success(`Orden ${orderData.order_number} creada automáticamente`);
      }
      setOrdersKey((k) => k + 1);
    } catch (error) {
      console.error('Error auto-generando orden:', error);
    } finally {
      pendingOrderRef.current.delete(scanData?.package?.tracking_number);
    }
  }, []);

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
        // Auto-generar/actualizar la orden de despacho tras cada escaneo exitoso
        if (action === 'lookup' && !data.already_dispatched) {
          autoGenerateOrder(data);
        }
      }
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || 'Error al procesar el escaneo';
      const notFound = error?.response?.status === 404 || error?.response?.data?.not_found;
      setLastResult({ error: message, tracking: cleaned, not_found: !!notFound });
    } finally {
      setProcessing(false);
    }
  }, [processing, autoGenerateOrder]);

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