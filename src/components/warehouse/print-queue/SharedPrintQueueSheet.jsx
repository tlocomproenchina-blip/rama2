import React from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import ConnectedSharedPrintQueue from './ConnectedSharedPrintQueue';

// Ventana lateral de la cola de impresión compartida.
export default function SharedPrintQueueSheet({ open, onOpenChange }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
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
  );
}