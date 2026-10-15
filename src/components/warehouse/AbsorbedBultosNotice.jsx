import React from 'react';
import { AlertTriangle, ArrowRightLeft } from 'lucide-react';

// Resultado de la absorción al guardar: qué bulto viejo se eliminó, cuántos paquetes
// se movieron y qué avisos dejó el almacén.
export default function AbsorbedBultosNotice({ absorbed }) {
  const bultos = absorbed?.bultos || [];
  if (!bultos.length) return null;

  const deleted = absorbed?.deleted || [];
  const failed = absorbed?.failed || [];
  const warnings = absorbed?.warnings || [];
  const stripped = (absorbed?.stripped || []).filter(Boolean);

  return (
    <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
      <p className="flex items-center gap-2 font-medium">
        <ArrowRightLeft className="h-4 w-4 shrink-0" /> Se fusionó el trabajo anterior
      </p>
      <ul className="space-y-1 text-xs">
        {bultos.map((entry, index) => (
          <li key={index}>
            <span className="font-mono font-semibold break-all">
              {entry.label_code || 'bulto sin etiqueta'}
            </span>
            {' · '}
            {entry.package_count || 0} paquete(s)
            {entry.order_numbers?.length ? ` · N° de contenedor ${entry.order_numbers.join(', ')}` : ''}
            {entry.absorbed_by ? ` · por ${entry.absorbed_by}` : ''}
          </li>
        ))}
      </ul>
      <p className="text-xs">
        {deleted.length} bulto(s) eliminado(s) · {absorbed?.packages_moved || 0} paquete(s) movidos a este bulto
      </p>
      {stripped.length > 0 && (
        <p className="text-xs">
          Se dejaron registrados sin el paquete movido:{' '}
          <span className="font-mono break-all">
            {stripped.map((s) => s.label_code || s.id).filter(Boolean).join(', ')}
          </span>
        </p>
      )}
      {failed.length > 0 && (
        <p className="flex items-start gap-1 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          No se pudieron eliminar: {failed.map((f) => f.label_code || f.id).join(', ')}. Revísalos para no dejarlos duplicados.
        </p>
      )}
      {warnings.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-xs text-amber-800">
          {warnings.map((message, index) => (
            <li key={index}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}