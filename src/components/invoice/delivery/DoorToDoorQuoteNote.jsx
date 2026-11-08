import React, { useEffect, useState } from 'react';
import { Truck } from 'lucide-react';
import { loadDoorToDoorRate } from '@/lib/doorToDoorRate';

// Aviso para el admin: el puerta a puerta se calcula solo y lo elige el cliente al pagar.
export default function DoorToDoorQuoteNote({ cbm }) {
  const [rate, setRate] = useState(null);
  useEffect(() => { loadDoorToDoorRate().then(setRate); }, []);
  const amount = rate === null ? null : (Number(cbm) || 0) * rate;

  return (
    <div className="space-y-1 rounded-lg border border-border bg-muted/50 p-3 text-xs text-slate-600">
      <p className="flex items-center gap-1.5 font-medium text-slate-800">
        <Truck className="h-3.5 w-3.5" /> Puerta a puerta automático
        {amount !== null && <span className="ml-auto font-mono">${amount.toFixed(2)}</span>}
      </p>
      <p>
        {rate === null ? 'Calculando…' : `${(Number(cbm) || 0).toFixed(4)} CBM × $${rate.toFixed(2)}/CBM.`} No se suma al total:
        el cliente elige en Mis Facturas si retira en almacén Valencia o lo recibe en su puerta, y ahí se fija el monto.
      </p>
    </div>
  );
}