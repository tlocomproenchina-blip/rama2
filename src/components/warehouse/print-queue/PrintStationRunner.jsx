import React, { useEffect, useState } from 'react';
import { resumeStationIfEnabled } from '@/lib/printStationRunner';
import SharedPrintQueueSheet from './SharedPrintQueueSheet';
import { startOutboxFlusher } from '@/lib/printOutbox';

// El botón "Impresión" del teléfono estación abre esta misma ventana (una sola).
export const OPEN_EVENT = 'tlec-open-station-queue';

// Mantiene activa la estación de impresión mientras el operador navega por la app.
// La ventana de la cola NO se abre sola: imprime y reconecta en segundo plano, y solo
// se muestra cuando el operador la abre con el botón "Impresión".
export default function PrintStationRunner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    resumeStationIfEnabled().catch(() => {});
    startOutboxFlusher();
    const openNow = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, openNow);
    return () => window.removeEventListener(OPEN_EVENT, openNow);
  }, []);

  return <SharedPrintQueueSheet open={open} onOpenChange={setOpen} />;
}