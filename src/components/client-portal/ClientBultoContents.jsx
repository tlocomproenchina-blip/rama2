import React from 'react';
import { Package, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';

// Paquetes dentro de una caja consolidada o bulto suelto, tal como los ve el cliente.
export default function ClientBultoContents({ bulto }) {
  const packages = bulto.packages || [];
  const known = new Set(packages.map((p) => p.tracking));
  const unregistered = bulto.unregistered_codes || [];
  // Trackings guardados en la unidad cuyo registro aún no llegó (escaneo sin sincronizar).
  const others = (bulto.trackings || []).filter((t) => !known.has(t) && !unregistered.includes(t));
  const unknown = [...unregistered, ...others];

  if (!packages.length && !unknown.length) {
    return <p className="text-xs text-slate-400">Tu carga está en almacén, el detalle se completa al escanearla.</p>;
  }

  return (
    <ul className="space-y-2">
      {packages.map((p) => (
        <li key={p.tracking} className="flex gap-3 rounded-lg bg-slate-50 p-2">
          {p.photo ? (
            <a href={p.photo} target="_blank" rel="noreferrer" className="shrink-0">
              <img src={p.photo} alt={p.tracking} className="h-14 w-14 rounded-md object-cover" />
            </a>
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-white"><Package className="h-4 w-4 text-slate-400" /></div>
          )}
          <div className="min-w-0 flex-1 text-xs">
            <p className="break-all font-mono font-semibold text-slate-800">{p.tracking}</p>
            <p className="line-clamp-2 text-slate-600">{p.description || 'Sin descripción'}</p>
            <p className="mt-0.5 text-slate-500">
              {p.received_date ? `Recibido ${format(new Date(p.received_date), 'dd/MM/yyyy')}` : 'Recepción —'}
              {p.cbm ? ` · ${p.cbm.toFixed(3)} CBM` : ''}
              {p.weight_kg ? ` · ${p.weight_kg} kg` : ''}
            </p>
          </div>
        </li>
      ))}
      {unknown.map((code) => (
        <li key={code} className="flex items-start gap-2 rounded-lg border border-dashed border-amber-200 bg-amber-50/60 p-2 text-xs">
          <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <p className="break-all font-mono font-semibold text-slate-800">{code}</p>
            <p className="text-amber-700">Estamos identificando este paquete.</p>
          </div>
        </li>
      ))}
    </ul>
  );
}