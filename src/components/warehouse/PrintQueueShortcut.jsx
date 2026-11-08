import React from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Aviso en la pestaña de empaque: hay etiquetas esperando impresión.
export default function PrintQueueShortcut({ count, onOpen }) {
  if (!count) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-accent px-3 py-2">
      <p className="text-sm font-semibold text-accent-foreground">
        {count} etiqueta{count !== 1 ? 's' : ''} en cola de impresión
      </p>
      <Button size="sm" onClick={onOpen} className="shrink-0">
        <Printer className="h-4 w-4" /> Imprimir
      </Button>
    </div>
  );
}