import React from 'react';
import { Loader2 } from 'lucide-react';

export default function PremiumLoader({ title = 'Cargando...', description = 'Preparando una experiencia más fluida.' }) {
  return (
    <div className="flex min-h-[260px] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[calc(var(--radius)+0.5rem)] border border-border/70 bg-card/95 p-8 text-center shadow-card backdrop-blur-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/8 text-primary">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}