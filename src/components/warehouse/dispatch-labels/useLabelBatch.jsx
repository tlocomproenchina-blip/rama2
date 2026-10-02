import { useCallback, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { toast } from 'sonner';
import { printCajaLabelBatch } from '@/lib/labelBatchPrint';

// Lote de etiquetas de despacho: carga todas las unidades por despachar del cliente,
// guarda el X/N que el operador escribe para cada etiqueta, imprime la tira continua y,
// al confirmarse la impresión, crea la guía de despacho con esas unidades.
const isValidNumber = (value) => Number.isInteger(Number(value)) && Number(value) >= 1;

// Valores con los que se precarga el X/N: los que la unidad ya tenía guardados.
const storedNumbers = (unit) =>
  unit?.is_caja && Number(unit.caja_number) > 0
    ? {
        index: String(unit.caja_number),
        total: Number(unit.caja_total) > 0 ? String(unit.caja_total) : '',
      }
    : { index: '', total: '' };

export default function useLabelBatch() {
  const [client, setClient] = useState(null);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState([]);
  const [labels, setLabels] = useState({});
  const [printing, setPrinting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [statusText, setStatusText] = useState('');
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState(null);
  const [printedUnits, setPrintedUnits] = useState([]);

  const loadUnits = useCallback(async (email) => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('listDispatchLabelUnits', { client_email: email });
      const data = res?.data || res || {};
      setUnits(Array.isArray(data.units) ? data.units : []);
      if (data.client) setClient((prev) => ({ ...(prev || {}), ...data.client }));
    } catch (_) {
      setUnits([]);
      toast.error('No se pudieron cargar las unidades del cliente');
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
      setSelected([]);
      setLabels({});
      setResult(null);
      setPrintedUnits([]);
      setStatusText('');
      loadUnits(email);
    },
    [loadUnits]
  );

  const prefill = (prev, code) => {
    if (prev[code]) return prev;
    const unit = units.find((u) => u.label_code === code);
    return { ...prev, [code]: storedNumbers(unit) };
  };

  const toggleUnit = useCallback(
    (code) => {
      setSelected((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
      setLabels((prev) => prefill(prev, code));
    },
    [units]
  );

  const toggleAll = useCallback(() => {
    if (units.length > 0 && selected.length === units.length) {
      setSelected([]);
      return;
    }
    setSelected(units.map((u) => u.label_code));
    setLabels((prev) => units.reduce((acc, unit) => prefill(acc, unit.label_code), prev));
  }, [selected.length, units]);

  const setLabelNumber = useCallback((code, field, value) => {
    setLabels((prev) => ({ ...prev, [code]: { ...(prev[code] || {}), [field]: value } }));
  }, []);

  const selectedUnits = useMemo(
    () => units.filter((u) => selected.includes(u.label_code)),
    [units, selected]
  );

  const missing = selectedUnits
    .filter((u) => !isValidNumber(labels[u.label_code]?.index) || !isValidNumber(labels[u.label_code]?.total))
    .map((u) => u.label_code);

  const totals = useMemo(
    () => ({
      packages: selectedUnits.reduce((sum, u) => sum + (Number(u.package_count) || 0), 0),
      cbm: Number(selectedUnits.reduce((sum, u) => sum + (Number(u.cbm) || 0), 0).toFixed(3)),
    }),
    [selectedUnits]
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
        setSelected([]);
        setLabels({});
        await loadUnits(client.email);
        if (data.already) {
          toast.info(`Estas etiquetas ya habían creado la guía ${data.guide.guide_number}`);
        } else {
          toast.success(
            `Guía ${data.guide.guide_number} creada con ${data.guide.totals?.bultos || lote.length} unidad(es)`
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
    if (!selectedUnits.length) {
      toast.error('Marca al menos una unidad para el lote');
      return;
    }
    if (missing.length) {
      toast.error(`Escribe el X/N de ${missing.length} etiqueta(s)`);
      return;
    }

    // La tira sale ordenada por el X/N escrito: es el orden físico de las etiquetas.
    const lote = selectedUnits
      .map((unit) => ({
        ...unit,
        caja_number: Number(labels[unit.label_code].index),
        caja_total: Number(labels[unit.label_code].total),
      }))
      .sort(
        (a, b) => a.caja_number - b.caja_number || String(a.label_code).localeCompare(String(b.label_code))
      );

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
      toast.error(e?.message || 'No se pudo imprimir el lote');
    }
  }, [client, createGuide, labels, missing, selectedUnits]);

  const retryCreate = useCallback(() => {
    if (printedUnits.length) createGuide(printedUnits);
  }, [createGuide, printedUnits]);

  const clearClient = useCallback(() => {
    setClient(null);
    setUnits([]);
    setSelected([]);
    setLabels({});
    setResult(null);
    setPrintedUnits([]);
    setStatusText('');
  }, []);

  return {
    client,
    units,
    loading,
    selected,
    labels,
    printing,
    progress,
    statusText,
    creating,
    result,
    printedCount: printedUnits.length,
    selectedUnits,
    missing,
    totals,
    selectClient,
    toggleUnit,
    toggleAll,
    setLabelNumber,
    printBatch,
    retryCreate,
    clearClient,
  };
}