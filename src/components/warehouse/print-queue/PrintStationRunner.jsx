import React, { useEffect, useRef, useState } from 'react';
import { getStationState, onStationState, resumeStationIfEnabled } from '@/lib/printStationRunner';
import SharedPrintQueueSheet from './SharedPrintQueueSheet';

// El botón "Impresión" del teléfono estación abre esta misma ventana (una sola).
export const OPEN_EVENT = 'tlec-open-station-queue';

// Mantiene activa la estación de impresión mientras el operador navega por la app.
// En el teléfono estación la ventana de la cola se abre sola: al activarse o retomarse
// la estación, en cada pantalla, y de nuevo cada vez que empieza a imprimir un trabajo.
export default function PrintStationRunner() {
  const [open, setOpen] = useState(() => getStationState().running);
  const lastJobRef = useRef(getStationState().current?.id || null);

  useEffect(() => {
    resumeStationIfEnabled().catch(() => {});
    let wasRunning = getStationState().running;
    const openNow = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, openNow);
    const off = onStationState((s) => {
      if (s.running && !wasRunning) setOpen(true);
      wasRunning = s.running;
      const jobId = s.current?.id || null;
      if (s.running && jobId && jobId !== lastJobRef.current) setOpen(true);
      lastJobRef.current = jobId;
    });
    return () => { off(); window.removeEventListener(OPEN_EVENT, openNow); };
  }, []);

  return <SharedPrintQueueSheet open={open} onOpenChange={setOpen} />;
}