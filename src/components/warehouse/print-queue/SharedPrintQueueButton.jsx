import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ListOrdered } from 'lucide-react';
import ConnectedSharedPrintQueue from './ConnectedSharedPrintQueue';

// Acceso a la cola compartida desde cualquier pantalla que imprime por Bluetooth.
export default function SharedPrintQueueButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" variant="ghost" className="self-start px-2 text-xs" onClick={() => setOpen(true)}>
        <ListOrdered className="h-4 w-4" /> Cola compartida
      </Button>
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