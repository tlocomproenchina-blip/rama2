import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { getPrintDeviceId } from '@/lib/printDevice';
import { getQueueState, onQueueChanged, retryJob } from '@/lib/printQueueApi';
import { getStationState, onStationState, startStation, stopStation } from '@/lib/printStationRunner';

const errText = (e) => e?.response?.data?.error || e?.message || 'Error';

// Estado compartido de la cola de impresión: estación activa, trabajos recientes y
// las acciones de tomar/soltar la estación y reintentar un trabajo fallido.
export default function useSharedPrintQueue() {
  const [data, setData] = useState({ station: null, jobs: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [retryingId, setRetryingId] = useState(null);
  const [runner, setRunner] = useState(getStationState());

  const refresh = useCallback(async () => {
    try {
      const d = await getQueueState();
      setData({ station: d?.station || null, jobs: d?.jobs || [] });
    } catch (_) {
      // sin conexión: se mantiene lo último cargado
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    let timer = null;
    const later = () => { clearTimeout(timer); timer = setTimeout(refresh, 600); };
    const poll = setInterval(refresh, 15000);
    let unsub = null;
    try { unsub = base44.entities.PrintJob.subscribe(later); } catch (_) {}
    const offQueue = onQueueChanged(later);
    const offRunner = onStationState((s) => { setRunner(s); later(); });
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      try { unsub?.(); } catch (_) {}
      offQueue();
      offRunner();
    };
  }, [refresh]);

  const start = async (pick = false) => {
    setBusy(true);
    try {
      await startStation({ pick });
      toast.success('Este teléfono ahora imprime la cola compartida');
    } catch (e) {
      toast.error(`No se pudo activar la estación: ${errText(e)}`);
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const stop = async () => {
    setBusy(true);
    await stopStation();
    setBusy(false);
    refresh();
  };

  const retry = async (job) => {
    setRetryingId(job.id);
    try {
      await retryJob(job.id);
      toast.success('Trabajo devuelto a la cola');
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setRetryingId(null);
      refresh();
    }
  };

  const isThisDevice = runner.running && data.station?.device_id === getPrintDeviceId();
  return { ...data, loading, busy, retryingId, runner, isThisDevice, start, stop, retry };
}