import React from 'react';

// Resumen de la corrección de conteos: revisados, ajustados y lo que quedó para revisar a mano.
export default function FixCountsResult({ result }) {
  const omitted = result.omitidos_detalle || [];
  const crossed = result.cruzados_detalle || [];
  return (
    <div className="space-y-2 text-xs">
      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
        Revisados: {result.revisados ?? 0} · Ajustados: {result.corregidos ?? 0} · Duplicados quitados:{' '}
        {result.duplicados_quitados ?? 0} · Guías actualizadas: {result.guias_actualizadas ?? 0}
      </p>
      {omitted.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
          <p className="font-semibold">Omitidos ({result.omitidos}): conteo manual sin duplicados que lo expliquen</p>
          <ul className="mt-1 max-h-24 overflow-y-auto space-y-0.5">
            {omitted.map((o) => (
              <li key={o.label_code} className="font-mono break-all">{o.label_code}: {o.motivo}</li>
            ))}
          </ul>
        </div>
      )}
      {crossed.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
          <p className="font-semibold">Trackings en más de una unidad ({result.cruzados}): revisar a mano</p>
          <ul className="mt-1 max-h-24 overflow-y-auto space-y-0.5">
            {crossed.map((c) => (
              <li key={c.code} className="font-mono break-all">{c.code} → {c.labels.join(', ')}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}