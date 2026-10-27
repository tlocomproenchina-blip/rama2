import { useCallback, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { toast } from 'sonner';
import { printCajaLabelBatch } from '@/lib/labelBatchPrint';

// Datos del cliente tal como van impresos en la etiqueta.
const snapshotOf = (client) => ({
  full_name: client?.full_name || '',
  cedula: client?.cedula || '',
  whatsapp: client?.whatsapp || '',
  address: client?.address || '',
  city: client?.city || '',
  state: client?.state || '',
  shipping_mark: client?.shipping_mark || '',
});

// Etiquetas de despacho: se elige el cliente y cuántas cajas van a salir. Se imprime una
// etiqueta por caja con los datos del cliente y el X/N de esa cantidad y, al confirmarse
// la impresión, se crea la guía de despacho con esas cajas. Cuando el cliente no tiene
// cajas pendientes la etiqueta sale igual —sin código QR y sin crear guía— porque
// el almacén necesita poder emitir una etiqueta de reemplazo. Todo lote impreso queda en
// el historial del cliente, desde donde se reimprime tal como salió.
export default function useLabelBatch() {
  const [client, setClient] = useState(null);
  const [units, setUnits] = useState([]);
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [reprintingId, setReprintingId] = useState('');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [statusText, setStatusText] = useState('');
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState(null);
  const [printedUnits, setPrintedUnits] = useState([]);
  const [lastLogId, setLastLogId] = useState('');
  const [historyKey, setHistoryKey] = useState(0);

  // Solo salen las cajas que todavía no están en una guía.
  const pending = useMemo(() => units.filter((unit) => !unit.in_guide), [units]);
  const count = Number(quantity) || 0;
  // Sin cajas pendientes la etiqueta sale igual: sin código QR y sin guía.
  const withoutBoxes = pending.length === 0;

  const bumpHistory = useCallback(() => setHistoryKey((key) => key + 1), []);

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
      setLastLogId('');
      setStatusText('');
      loadUnits(email);
    },
    [loadUnits]
  );

  // Registra el lote en el historial: lo que salió impreso, con su guía cuando la hubo.
  // Con sourceLog se reimprime un lote del historial: se registra como reimpresión y se
  // reproduce desde sus propios datos guardados, no desde el cliente actual.
  const registerPrint = useCallback(
    async ({ lote, printType, outcome, sourceLog = null, guide = null }) => {
      const payload = {
        client_email: sourceLog?.client_email || client?.email || '',
        client_name: sourceLog?.client_name || client?.full_name || '',
        shipping_mark: sourceLog?.shipping_mark || client?.shipping_mark || '',
        quantity: lote.length,
        index_from: lote[0]?.caja_number || 1,
        index_to: lote[0]?.caja_total || lote.length,
        units: lote.map((unit) => ({
          code: unit.label_code || '',
          index: unit.caja_number || 0,
          total: unit.caja_total || 0,
          package_count: unit.package_count || 0,
          cbm: unit.cbm || 0,
          is_caja: !!unit.is_caja,
        })),
        guide_id: guide?.id || sourceLog?.guide_id || '',
        guide_number: guide?.guide_number || sourceLog?.guide_number || '',
        without_boxes: sourceLog ? !!sourceLog.without_boxes : withoutBoxes,
        print_type: printType,
        source_log_id: sourceLog?.id || '',
        outcome,
        client_snapshot: sourceLog?.client_snapshot || snapshotOf(client),
      };
      try {
        const res = await base44.functions.invoke('registerLabelPrint', payload);
        const data = res?.data || res || {};
        return data.log || null;
      } catch (_) {
        return null;
      }
    },
    [client, withoutBoxes]
  );

  // La guía se crea después de imprimir: su número completa el registro del historial.
  const attachGuideToLog = useCallback(async (logId, guide) => {
    if (!logId || !guide) return;
    try {
      await base44.functions.invoke('registerLabelPrint', {
        log_id: logId,
        guide_id: guide.id || '',
        guide_number: guide.guide_number || '',
      });
    } catch (_) {}
  }, []);

  const createGuide = useCallback(
    async (lote) => {
      setCreating(true);
      let guide = null;
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
        guide = data.guide;
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
      return guide;
    },
    [client, loadUnits]
  );

  // Lote que sale impreso: las primeras cajas pendientes hasta la cantidad escrita, o
  // una etiqueta por unidad escrita cuando el cliente no tiene cajas por despachar.
  const buildLote = useCallback(
    (amount) => {
      if (withoutBoxes) {
        return Array.from({ length: amount }, (_, position) => ({
          label_code: '',
          caja_number: position + 1,
          caja_total: amount,
          package_count: 0,
          cbm: 0,
          is_caja: false,
        }));
      }
      return pending.slice(0, amount).map((unit, position) => ({
        ...unit,
        caja_number: position + 1,
        caja_total: amount,
      }));
    },
    [pending, withoutBoxes]
  );

  const printBatch = useCallback(async () => {
    if (!count) return;
    if (!withoutBoxes && count > pending.length) {
      toast.error(`El cliente solo tiene ${pending.length} caja(s) pendientes por despachar`);
      return;
    }

    const lote = buildLote(count);
    let printed = 0;

    setPrinting(true);
    setResult(null);
    setPrintedUnits([]);
    setLastLogId('');
    setProgress({ done: 0, total: lote.length });
    setStatusText('Conectando impresora…');

    try {
      await printCajaLabelBatch({
        client: snapshotOf(client),
        cajas: lote,
        emittedAt: new Date().toISOString(),
        onProgress: (done, total) => {
          printed = done;
          setStatusText('');
          setProgress({ done, total });
        },
      });

      setPrintedUnits(lote);
      setPrinting(false);
      setStatusText('');

      if (withoutBoxes) {
        setQuantity('');
        await registerPrint({ lote, printType: 'primera', outcome: 'completa' });
        toast.success(
          `${lote.length} etiqueta(s) impresas sin guía: el cliente no tiene cajas pendientes`
        );
      } else {
        const guide = await createGuide(lote);
        const log = await registerPrint({ lote, guide, printType: 'primera', outcome: 'completa' });
        setLastLogId(log?.id || '');
      }
    } catch (e) {
      // Una impresión cortada queda anotada para poder reimprimir ese mismo lote.
      if (printed > 0) {
        await registerPrint({ lote, printType: 'primera', outcome: 'incompleta' });
      }
      setPrintedUnits([]);
      setStatusText('');
      setPrinting(false);
      toast.error(e?.message || 'No se pudo imprimir la etiqueta');
    }
    bumpHistory();
  }, [buildLote, bumpHistory, client, count, createGuide, pending.length, registerPrint, withoutBoxes]);

  const retryCreate = useCallback(async () => {
    if (!printedUnits.length) return;
    const guide = await createGuide(printedUnits);
    if (guide) {
      await attachGuideToLog(lastLogId, guide);
      bumpHistory();
    }
  }, [attachGuideToLog, bumpHistory, createGuide, lastLogId, printedUnits]);

  // Reimprime un lote del historial: las mismas etiquetas, con sus mismos datos y su
  // mismo X/N, sin crear guía nueva ni tocar guías, bultos o escaneos.
  const reprint = useCallback(
    async (log) => {
      const stored = Array.isArray(log?.units) ? log.units : [];
      const lote = stored.map((unit, position) => ({
        label_code: unit.label_code || '',
        caja_number: Number(unit.index) || position + 1,
        caja_total: Number(unit.total) || stored.length,
        package_count: Number(unit.package_count) || 0,
        cbm: Number(unit.cbm) || 0,
        is_caja: !!unit.is_caja,
      }));
      if (!lote.length) {
        toast.error('Ese lote no tiene etiquetas guardadas');
        return;
      }

      setReprintingId(log.id);
      let printed = 0;
      try {
        await printCajaLabelBatch({
          client: log.client_snapshot || {},
          cajas: lote,
          emittedAt: log.printed_date || new Date().toISOString(),
          onProgress: (done) => {
            printed = done;
          },
        });
        await registerPrint({ lote, sourceLog: log, printType: 'reimpresion', outcome: 'completa' });
        toast.success(`${lote.length} etiqueta(s) reimpresas`);
      } catch (e) {
        if (printed > 0) {
          await registerPrint({ lote, sourceLog: log, printType: 'reimpresion', outcome: 'incompleta' });
        }
        toast.error(e?.message || 'No se pudo reimprimir la etiqueta');
      }
      setReprintingId('');
      bumpHistory();
    },
    [bumpHistory, registerPrint]
  );

  const clearClient = useCallback(() => {
    setClient(null);
    setUnits([]);
    setQuantity('');
    setResult(null);
    setPrintedUnits([]);
    setLastLogId('');
    setStatusText('');
  }, []);

  return {
    client,
    loading,
    quantity,
    setQuantity,
    count,
    pendingCount: pending.length,
    withoutBoxes,
    printing,
    reprintingId,
    progress,
    statusText,
    creating,
    result,
    printedCount: printedUnits.length,
    historyKey,
    selectClient,
    printBatch,
    retryCreate,
    clearClient,
    reprint,
  };
}