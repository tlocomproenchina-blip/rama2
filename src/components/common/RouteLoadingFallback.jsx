import React from 'react';
import { Loader2 } from 'lucide-react';

export default function RouteLoadingFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/90 px-4 py-3 shadow-card">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm font-medium text-muted-foreground">Cargando pantalla...</span>
      </div>
    </div>
  );
}