import { useCallback, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { toast } from 'sonner';
import { printCajaLabelBatch } from '@/lib/labelBatchPrint';

// Etiqueta única de despacho: se elige el cliente y cuántas cajas van a salir. Se
// imprime una etiqueta por caja (la misma etiqueta, con los datos del cliente y el X/N
// de esa cantidad) y, al confirmarse la impresión, se crea la guía de despacho con esas
// cajas. Si la impresión falla, no se crea guía.
export default function useLabelBatch() {
  const [client, setClient] = useState(null);
  const [units, setUnits] = useState([]);
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [statusText, setStatusText] = useState('');
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState(null);
  const [printedUnits, setPrintedUnits] = useState([]);

  // Solo salen las cajas que todavía no están en una guía.
  const pending = useMemo(() => units.filter((unit) => !unit.in_guide), [units]);
  const count = Number(quantity) || 0;

  const loadUnits = useCallback(async (email) => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('listDispatchLabelUnits', { client_email: email });
      const data = res?.data || res || {};
      setUnits(Array.isArray(data.units) ? data.units : []);
      if (data.client) setClient((prev) => ({ ...(prev || {}), ...data.client }));
    } catch (_) {
      setUnits([]);
      toast.error('No se pudieron cargar las cajas del cliente');
    }
    setLoading(false);
  }, []);

  const selectClient = useCallback(
    (picked) => {
      const email = String(picked?.email || '').trim();
      if (!email) {
        toast.error('Ese cliente no tiene email registrado');
        return;
      }
      setClient({ ...picked, email });
      setUnits([]);
      setQuantity('');
      setResult(null);
      setPrintedUnits([]);
      setStatusText('');
      loadUnits(email);
    },
    [loadUnits]
  );

  const createGuide = useCallback(
    async (lote) => {
      setCreating(true);
      try {
        const res = await base44.functions.invoke('createGuideFromLabelBatch', {
          client_email: client?.email || '',
          units: lote.map((unit) => ({
            code: unit.label_code,
            index: unit.caja_number,
            total: unit.caja_total,
          })),
        });
        const data = res?.data || res || {};
        if (!data.guide) throw new Error(data.error || 'No se pudo crear la guía');
        setResult({ guide: data.guide, excluded: data.excluded || [] });
        setPrintedUnits([]);
        setQuantity('');
        await loadUnits(client.email);
        if (data.already) {
          toast.info(`Estas etiquetas ya habían creado la guía ${data.guide.guide_number}`);
        } else {
          toast.success(
            `Guía ${data.guide.guide_number} creada con ${data.guide.totals?.bultos || lote.length} caja(s)`
          );
        }
      } catch (e) {
        toast.error(e?.response?.data?.error || e?.message || 'No se pudo crear la guía');
      }
      setCreating(false);
    },
    [client, loadUnits]
  );

  const printBatch = useCallback(async () => {
    if (!count) return;
    if (count > pending.length) {
      toast.error(`El cliente solo tiene ${pending.length} caja(s) pendientes por despachar`);
      return;
    }

    // Las cajas que salen: las primeras pendientes, numeradas X/N con la cantidad escrita.
    const lote = pending.slice(0, count).map((unit, position) => ({
      ...unit,
      caja_number: position + 1,
      caja_total: count,
    }));

    setPrinting(true);
    setResult(null);
    setPrintedUnits([]);
    setProgress({ done: 0, total: lote.length });
    setStatusText('Conectando impresora…');

    try {
      await printCajaLabelBatch({
        client: {
          full_name: client?.full_name || '',
          cedula: client?.cedula || '',
          whatsapp: client?.whatsapp || '',
          address: client?.address || '',
          city: client?.city || '',
          state: client?.state || '',
          shipping_mark: client?.shipping_mark || '',
        },
        cajas: lote,
        emittedAt: new Date().toISOString(),
        onProgress: (done, total) => {
          setStatusText('');
          setProgress({ done, total });
        },
      });

      setPrintedUnits(lote);
      setPrinting(false);
      setStatusText('');
      await createGuide(lote);
    } catch (e) {
      setPrintedUnits([]);
      setStatusText('');
      setPrinting(false);
      toast.error(e?.message || 'No se pudo imprimir la etiqueta');
    }
  }, [client, count, createGuide, pending]);

  const retryCreate = useCallback(() => {
    if (printedUnits.length) createGuide(printedUnits);
  }, [createGuide, printedUnits]);

  const clearClient = useCallback(() => {
    setClient(null);
    setUnits([]);
    setQuantity('');
    setResult(null);
    setPrintedUnits([]);
    setStatusText('');
  }, []);

  return {
    client,
    loading,
    quantity,
    setQuantity,
    count,
    pendingCount: pending.length,
    printing,
    progress,
    statusText,
    creating,
    result,
    printedCount: printedUnits.length,
    selectClient,
    printBatch,
    retryCreate,
    clearClient,
  };
}