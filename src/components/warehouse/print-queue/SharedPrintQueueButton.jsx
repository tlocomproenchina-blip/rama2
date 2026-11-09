import React, { useEffect, useState } from 'react';
import { getStationState, onStationState } from '@/lib/printStationRunner';
import { OPEN_EVENT } from './PrintStationRunner';
import { Button } from '@/components/ui/button';
import { ListOrdered, Printer } from 'lucide-react';
import SharedPrintQueueSheet from './SharedPrintQueueSheet';

// Acceso a la cola compartida desde cualquier pantalla que imprime por Bluetooth.
// variant="header": botón compacto de la cabecera, visible para todo el personal.
export default function SharedPrintQueueButton({ variant = 'inline' }) {
  const [ownOpen, setOwnOpen] = useState(false);
  // En el teléfono estación la ventana la maneja la estación (se abre sola).
  useEffect(() => onStationState((s) => { if (s.running) setOwnOpen(false); }), []);
  const open = ownOpen;
  const setOpen = (v) => {
    if (v && getStationState().running) window.dispatchEvent(new Event(OPEN_EVENT));
    else setOwnOpen(v);
  };
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
      <SharedPrintQueueSheet open={open} onOpenChange={setOpen} />
    </>
  );
}