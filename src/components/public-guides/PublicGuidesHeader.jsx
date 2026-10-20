import React from 'react';
import { ClipboardList } from 'lucide-react';

// Encabezado del portal público de guías de despacho: marca de TLEC CARGO y la
// explicación de lo que se puede consultar aquí.
export default function PublicGuidesHeader() {
  return (
    <header className="rounded-2xl border border-border bg-card p-4 md:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ClipboardList className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-lg font-bold text-foreground md:text-xl">Guías de despacho</p>
          <p className="text-sm text-muted-foreground">
            Consulta por cliente, shipping mark, contenedor o número de guía. Verás tus contenedores y los
            bultos de cada uno, con la opción de imprimir o descargar el informe.
          </p>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        TLEC CARGO · Tu carga asegurada desde China hasta Venezuela
      </p>
    </header>
  );
}