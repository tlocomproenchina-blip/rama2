import React from 'react';
import { ClipboardList } from 'lucide-react';
import DispatchOrdersPanel from '@/components/dispatch-order/DispatchOrdersPanel';

// Orden de Despacho: el panel vive en DispatchOrdersPanel y se muestra igual desde
// esta página y desde la pestaña "Órdenes despacho" de Guías de Despacho.
export default function AdminDispatchOrders() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <ClipboardList className="h-6 w-6 text-blue-600" /> Orden de Despacho
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Elige el período: se agrupan todas las facturas pagadas en esos días y se arma la orden con los
          clientes por ciudad, el N° de contenedor pagado y cuántas cajas y bultos le corresponden a cada uno.
        </p>
      </div>

      <DispatchOrdersPanel />
    </div>
  );
}