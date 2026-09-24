import React from 'react';
import { ScanLine } from 'lucide-react';
import DispatchScanHistoryPanel from '@/components/warehouse/DispatchScanHistoryPanel';

export default function WarehouseDispatchScanHistory({ user }) {
  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ScanLine className="h-6 w-6 text-blue-600" /> Historial de Escaneos de Despacho
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Registro de todos los códigos escaneados desde la página de Despacho por Escaneo.
        </p>
      </div>
      <DispatchScanHistoryPanel title="Historial de escaneos" />
    </div>
  );
}