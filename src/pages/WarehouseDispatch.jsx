import React, { useState, useCallback } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ScanLine, Truck } from 'lucide-react';
import BarcodeScannerModule from '@/components/warehouse/BarcodeScannerModule';
import DispatchResultCard from '@/components/warehouse/DispatchResultCard';
import DispatchGroupedList from '@/components/warehouse/DispatchGroupedList';

export default function WarehouseDispatch() {
  const [code, setCode] = useState('');
  const [processing, setProcessing] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [scans, setScans] = useState([]);

  const handleScan = useCallback(async (tracking) => {
    const cleaned = (tracking || '').trim();
    if (!cleaned || processing) return;
    setProcessing(true);
    setCode('');
    try {
      const response = await base44.functions.invoke('scanDispatchPackage', { tracking_number: cleaned });
      const data = response?.data || response;
      setLastResult(data);
      setScans((prev) => [data, ...prev]);
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || 'Error al procesar el escaneo';
      setLastResult({ error: message, tracking: cleaned });
    } finally {
      setProcessing(false);
    }
  }, [processing]);

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
        actionLabel="Despachar"
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

      <DispatchResultCard result={lastResult} />

      {scans.length === 0 && !lastResult && (
        <div className="text-center py-10 text-slate-400">
          <ScanLine className="h-10 w-10 mx-auto mb-2" />
          <p className="text-sm">Aún no has escaneado ningún paquete en esta sesión.</p>
        </div>
      )}

      <DispatchGroupedList scans={scans} />
    </div>
  );
}