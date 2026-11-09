import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ListOrdered, Printer } from 'lucide-react';
import ConnectedSharedPrintQueue from './ConnectedSharedPrintQueue';

// Acceso a la cola compartida desde cualquier pantalla que imprime por Bluetooth.
// variant="header": botón compacto de la cabecera, visible para todo el personal.
export default function SharedPrintQueueButton({ variant = 'inline' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {variant === 'header' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Cola de impresión compartida"
          className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border/80 bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
        >
          <Printer className="h-4 w-4 shrink-0" />
          <span className="hidden whitespace-nowrap sm:inline">Impresión</span>
        </button>
      ) : (
        <Button type="button" size="sm" variant="ghost" className="self-start px-2 text-xs" onClick={() => setOpen(true)}>
          <ListOrdered className="h-4 w-4" /> Cola compartida
        </Button>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="mb-4">
            <SheetTitle className="font-display">Cola de impresión compartida</SheetTitle>
            <SheetDescription>
              Un teléfono tiene la impresora y la imprime en orden para todos los operadores.
            </SheetDescription>
          </SheetHeader>
          {open && <ConnectedSharedPrintQueue />}
        </SheetContent>
      </Sheet>
    </>
  );
}