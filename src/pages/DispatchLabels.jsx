import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Tags } from 'lucide-react';
import { toast } from 'sonner';
import ClientSearchBox from '@/components/manual-billing/ClientSearchBox';
import DispatchLabelClientCard from '@/components/warehouse/dispatch-labels/DispatchLabelClientCard';
import CajaBatchList from '@/components/warehouse/dispatch-labels/CajaBatchList';
import LabelBatchSummary from '@/components/warehouse/dispatch-labels/LabelBatchSummary';
import LabelBatchResult from '@/components/warehouse/dispatch-labels/LabelBatchResult';
import { printCajaLabelBatch } from '@/lib/labelBatchPrint';

// Etiquetas de Despacho: se marca el lote de cajas de un cliente, se imprime su tira
// continua (X/N con el código de barras de cada caja) y, al confirmarse la impresión,
// nace la guía de despacho con esas cajas. Si la impresión falla, no se crea guía.
export default function DispatchLabels() {
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [cajas, setCajas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState([]);
  const [printing, setPrinting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [statusText, setStatusText] = useState('');
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState(null);
  const [printedCodes, setPrintedCodes] = useState([]);

  const loadCajas = useCallback(async (email) => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('listDispatchLabelCajas', { client_email: email });
      const data = res?.data || res || {};
      setCajas(Array.isArray(data.cajas) ? data.cajas : []);
      if (data.client) setClient((prev) => ({ ...(prev || {}), ...data.client }));
    } catch (e) {
      setCajas([]);
      toast.error('No se pudieron cargar las cajas del cliente');
    }
    setLoading(false);
  }, []);

  const handleSelectClient = (picked) => {
    const email = String(picked?.email || '').trim();
    if (!email) {
      toast.error('Ese cliente no tiene email registrado');
      return;
    }
    setClient({ ...picked, email });
    setCajas([]);
    setSelected([]);
    setResult(null);
    setPrintedCodes([]);
    setStatusText('');
    loadCajas(email);
  };

  const selectable = cajas.filter((caja) => !caja.in_guide);
  const selectedCajas = useMemo(
    () => selectable.filter((caja) => selected.includes(caja.label_code)),
    [selectable, selected]
  );
  const totalPackages = selectedCajas.reduce((sum, caja) => sum + (Number(caja.package_count) || 0), 0);
  const totalCbm = Number(
    selectedCajas.reduce((sum, caja) => sum + (Number(caja.cbm) || 0), 0).toFixed(3)
  );

  const toggleCaja = (code) =>
    setSelected((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  const toggleAll = () =>
    setSelected(selected.length === selectable.length ? [] : selectable.map((caja) => caja.label_code));

  const createGuide = async (codes) => {
    setCreating(true);
    try {
      const res = await base44.functions.invoke('createGuideFromLabelBatch', {
        client_email: client.email,
        codes,
      });
      const data = res?.data || res || {};
      if (!data.guide) throw new Error(data.error || 'No se pudo crear la guía');
      setResult({ guide: data.guide, excluded: data.excluded || [] });
      setPrintedCodes([]);
      setSelected([]);
      await loadCajas(client.email);
      if (data.already) {
        toast.info(`Estas etiquetas ya habían creado la guía ${data.guide.guide_number}`);
      } else {
        toast.success(
          `Guía ${data.guide.guide_number} creada con ${data.guide.totals?.bultos || codes.length} caja(s)`
        );
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'No se pudo crear la guía');
    }
    setCreating(false);
  };

  const handlePrint = async () => {
    if (!selectedCajas.length) {
      toast.error('Marca al menos una caja para el lote');
      return;
    }

    setPrinting(true);
    setResult(null);
    setPrintedCodes([]);
    setProgress({ done: 0, total: selectedCajas.length });
    setStatusText('Numerando el lote…');

    try {
      // 1. El servidor fija el X/N de las cajas del lote tal como se va a imprimir.
      const res = await base44.functions.invoke('assignCajaLabels', {
        client_email: client.email,
        caja_ids: selectedCajas.map((caja) => caja.id),
      });
      const lote = (res?.data?.cajas || [])
        .slice()
        .sort((a, b) => (Number(a.caja_number) || 0) - (Number(b.caja_number) || 0));
      if (!lote.length) throw new Error('No se pudo numerar el lote de etiquetas');

      // 2. Impresión física del lote en la impresora térmica.
      setStatusText('Conectando impresora…');
      await printCajaLabelBatch({
        client: {
          full_name: client.full_name || '',
          cedula: client.cedula || '',
          whatsapp: client.whatsapp || '',
          address: client.address || '',
          city: client.city || '',
          state: client.state || '',
          shipping_mark: client.shipping_mark || '',
        },
        cajas: lote,
        emittedAt: new Date().toISOString(),
        onProgress: (done, total) => {
          setStatusText('');
          setProgress({ done, total });
        },
      });

      const codes = lote.map((caja) => caja.label_code);
      setPrintedCodes(codes);
      setPrinting(false);
      setStatusText('');
      setCreating(true);

      // 3. La guía nace con las cajas del lote (nunca si la impresión falló).
      await createGuide(codes);
    } catch (e) {
      setPrintedCodes([]);
      setStatusText('');
      setPrinting(false);
      toast.error(e?.message || 'No se pudo imprimir el lote');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <Tags className="h-6 w-6 text-blue-600" /> Etiquetas de Despacho
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Marca las cajas que van a salir, imprime su tira continua de etiquetas y la guía de
          despacho se crea sola con esas cajas.
        </p>
      </div>

      {!client ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-xs text-slate-500">
              Busca al cliente para ver sus cajas pendientes de despacho.
            </p>
            <ClientSearchBox onSelect={handleSelectClient} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <DispatchLabelClientCard client={client} onChange={() => setClient(null)} />

          <LabelBatchResult
            guide={result?.guide}
            excluded={result?.excluded || []}
            printedCount={printedCodes.length}
            creating={creating}
            onRetryCreate={() => printedCodes.length && createGuide(printedCodes)}
            onOpenGuides={() =>
              navigate('/DispatchGuides', { state: { highlightGuideId: result?.guide?.id || '' } })
            }
          />

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : (
            <Card>
              <CardContent className="space-y-3 p-4">
                <CajaBatchList
                  cajas={cajas}
                  selected={selected}
                  onToggle={toggleCaja}
                  onToggleAll={toggleAll}
                  disabled={printing || creating}
                />
                <LabelBatchSummary
                  count={selectedCajas.length}
                  packages={totalPackages}
                  cbm={totalCbm}
                  printing={printing}
                  progress={progress}
                  statusText={statusText}
                  onPrint={handlePrint}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}