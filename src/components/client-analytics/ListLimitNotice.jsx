import React from 'react';
import { AlertTriangle } from 'lucide-react';

// Avisa cuando una lista llegó a su tope de carga y por eso puede estar incompleta.
export default function ListLimitNotice({ sections }) {
  if (!sections.length) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-warning">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <p className="m-0">
        Se alcanzó el máximo de registros cargados en: <strong>{sections.join(', ')}</strong>. Los totales de esas secciones y sus descargas pueden estar incompletos; revisa el módulo correspondiente para el detalle completo.
      </p>
    </div>
  );
}