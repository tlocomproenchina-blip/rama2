import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

// Resultado del desarmado: unidades restauradas, las que fallaron y qué pasó con la original.
export default function DismantleResult({ result }) {
  const restored = result?.restored || [];
  const failed = result?.failed || [];
  return (
    <div className="space-y-3 text-sm">
      <div className="space-y-1.5">
        {restored.map((r) => (
          <div key={r.id} className="flex items-center gap-2 rounded-lg bg-green-50 px-2.5 py-1.5 text-green-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="font-mono">{r.label_code}</span>
            <span className="text-xs">· {r.package_count} paq.</span>
            {r.original_label && r.original_label !== r.label_code && (
              <span className="text-xs">(antes {r.original_label})</span>
            )}
          </div>
        ))}
        {failed.map((label, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-red-700">
            <XCircle className="h-4 w-4 shrink-0" />
            <span className="font-mono">{label}</span>
            <span className="text-xs">· no se pudo restaurar, sigue dentro de {result.parent_label}</span>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground">
        {result.parent_status === 'desarmado'
          ? `${result.parent_label} quedó como «Desarmado» (solo historial).`
          : `${result.parent_label} conserva ${result.parent_keeps_packages} paquete(s) propio(s).`}
      </p>
    </div>
  );
}