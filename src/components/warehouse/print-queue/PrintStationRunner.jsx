import { useEffect } from 'react';
import { resumeStationIfEnabled } from '@/lib/printStationRunner';

// Mantiene activa la estación de impresión mientras el operador navega por la app.
export default function PrintStationRunner() {
  useEffect(() => {
    resumeStationIfEnabled().catch(() => {});
  }, []);
  return null;
}