import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';
import DispatchOrderDateRange from '@/components/dispatch-order/DispatchOrderDateRange';
import DispatchOrderSummaryCards from '@/components/dispatch-order/DispatchOrderSummaryCards';
import DispatchOrderActions from '@/components/dispatch-order/DispatchOrderActions';
import DispatchOrderMessagePreview from '@/components/dispatch-order/DispatchOrderMessagePreview';
import DispatchOrderGroupedView from '@/components/dispatch-order/DispatchOrderGroupedView';
import DispatchOrderHistoryList from '@/components/dispatch-order/DispatchOrderHistoryList';
import DispatchOrderPhoneNotice from '@/components/dispatch-order/DispatchOrderPhoneNotice';
import { buildWhatsappLink, downloadDispatchOrderTxt } from '@/lib/dispatchOrderTxt';

// Orden de despacho: agrupa TODO lo facturado en un período de días (por fecha de pago)
// para que el almacén sepa qué clientes buscar, qué N° de contenedor se pagó y qué
// cajas consolidadas o bultos sueltos le corresponden. Se manda por WhatsApp al teléfono
// del almacén guardado en Configuración y también se descarga como TXT.
// Se usa igual desde su página y desde la pestaña "Órdenes despacho" de Guías de Despacho.
const dayKey = (date) => format(date, 'yyyy-MM-dd');

export default function DispatchOrdersPanel() {
  const [from, setFrom] = useState(dayKey(subDays(new Date(), 6)));
  const [to, setTo] = useState(dayKey(new Date()));
  const [sheet, setSheet] = useState(null);
  const [text, setText] = useState('');
  const [phone, setPhone] = useState('');
  const [warehouseLabel, setWarehouseLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = useCallback(async () => {
    const page = await base44.entities.DispatchOrderSheet
      .filter({}, { sort: '-period_to', limit: 10 })
      .catch(() => ({ items: [] }));
    setHistory(page?.items || []);
    setLoadingHistory(false);
  }, []);

  const loadConfig = useCallback(async () => {
    const rows = await base44.entities.DispatchOrderConfig
      .filter({ config_key: 'main' }, '-updated_date', 1)
      .catch(() => []);
    setPhone(rows?.[0]?.warehouse_whatsapp_phone || '');
    setWarehouseLabel(rows?.[0]?.warehouse_label || '');
  }, []);

  useEffect(() => {
    loadHistory();
    loadConfig();
  }, [loadHistory, loadConfig]);

  const generate = async (force = false) => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getDispatchOrderSheet', { from, to, force });
      const data = res?.data || {};
      if (data.error) {
        toast.error(data.error);
        return;
      }
      if (data.empty) {
        setSheet(null);
        setText('');
        toast.info(data.message || 'No hay nada que despachar en ese período.');
        return;
      }
      setSheet(data.sheet);
      setText(data.text || '');
      if (data.whatsapp_phone) setPhone(data.whatsapp_phone);
      if (data.warehouse_label) setWarehouseLabel(data.warehouse_label);
      await loadHistory();
      if (data.regenerated) toast.success('Orden regenerada con los bultos y cajas actuales');
      else if (data.reused) toast.info('Ese período ya tenía una orden generada: se muestra la guardada');
      else toast.success('Orden de despacho generada');
    } catch (error) {
      toast.error('No se pudo generar la orden de despacho');
    }
    setLoading(false);
  };

  const markSent = (target) => {
    if (!target?.id) return;
    const now = new Date().toISOString();
    base44.entities.DispatchOrderSheet
      .update(target.id, { whatsapp_sent_date: now, whatsapp_phone: phone })
      .then(() => {
        setSheet((prev) => (prev?.id === target.id ? { ...prev, whatsapp_sent_date: now, whatsapp_phone: phone } : prev));
        loadHistory();
      })
      .catch(() => {});
  };

  const handleWhatsapp = () => {
    const link = buildWhatsappLink(phone, text);
    if (!link) {
      toast.error('Configura el número de WhatsApp del almacén en Configuración');
      return;
    }
    window.open(link, '_blank', 'noopener');
    markSent(sheet);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Mensaje copiado: ya puedes pegarlo en WhatsApp');
    } catch (error) {
      toast.error('No se pudo copiar el mensaje');
    }
  };

  const openSheet = async (record) => {
    setSheet(record);
    setText(record.message_text || '');
    setFrom(record.period_from);
    setTo(record.period_to);
    if (record.whatsapp_phone) setPhone(record.whatsapp_phone);
    // El texto se rearma desde el snapshot guardado, para que la orden que se abra
    // salga con el mismo formato que las recién generadas.
    const res = await base44.functions
      .invoke('getDispatchOrderSheet', { from: record.period_from, to: record.period_to })
      .catch(() => null);
    if (res?.data?.text) setText(res.data.text);
  };

  return (
    <div className="space-y-5">
      <DispatchOrderPhoneNotice phone={phone} />

      <DispatchOrderDateRange
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onGenerate={generate}
        onRegenerate={() => generate(true)}
        canRegenerate={!!sheet}
        loading={loading}
      />

      {sheet && (
        <>
          <DispatchOrderSummaryCards sheet={sheet} />
          <DispatchOrderActions
            sheet={sheet}
            phone={phone}
            warehouseLabel={warehouseLabel}
            onWhatsapp={handleWhatsapp}
            onDownload={() => downloadDispatchOrderTxt(sheet, text)}
            onCopy={handleCopy}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <DispatchOrderGroupedView sheet={sheet} />
            <DispatchOrderMessagePreview text={text} />
          </div>
        </>
      )}

      <DispatchOrderHistoryList
        items={history}
        loading={loadingHistory}
        activeId={sheet?.id}
        onOpen={openSheet}
        onRefresh={loadHistory}
      />
    </div>
  );
}