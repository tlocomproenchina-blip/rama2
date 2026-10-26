import React from 'react';
import { Boxes } from 'lucide-react';

const BULTO_STATUS = {
  activo: 'border-sky-200 bg-sky-50 text-sky-700',
  cerrado: 'border-slate-200 bg-slate-100 text-slate-600',
  en_almacen_ve: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  despachado: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

// Bultos y cajas consolidadas despachadas con este contenedor.
export default function ContainerBultoList({ bultos = [] }) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Boxes className="h-3.5 w-3.5" /> Bultos y cajas
      </p>
      {!bultos.length && <p className="text-xs text-slate-500">Sin bultos registrados.</p>}
      {!!bultos.length && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] text-slate-700">
            <thead>
              <tr className="text-slate-400">
                <th className="py-1 pr-2 font-medium">Etiqueta</th>
                <th className="py-1 pr-2 font-medium">Paquetes</th>
                <th className="py-1 pr-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {bultos.map((bulto) => (
                <tr key={bulto.id} className="border-t border-slate-100">
                  <td className="py-1 pr-2">
                    <span className="font-medium text-slate-800">{bulto.label_code}</span>
                    {bulto.is_caja && <span className="ml-1 text-indigo-600">caja</span>}
                  </td>
                  <td className="py-1 pr-2">{bulto.package_count}</td>
                  <td className="py-1 pr-2">
                    <span className={`rounded-full border px-2 py-0.5 ${BULTO_STATUS[bulto.status] || BULTO_STATUS.cerrado}`}>
                      {bulto.status || 'sin estado'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}