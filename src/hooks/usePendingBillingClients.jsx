import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';

// Clientes con mercancía pendiente de facturar: bultos sin factura vigente agrupados
// por cliente (misma fuente que alimenta 'Carga en almacén'), con sus N° de orden/envío.
export default function usePendingBillingClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [markingId, setMarkingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('getWarehouseBillingClients', {});
      if (res?.data?.error) throw new Error(res.data.error);
      setClients(Array.isArray(res?.data?.clients) ? res.data.clients : []);
    } catch (e) {
      setError(e?.message || 'No se pudo cargar la carga pendiente');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Guarda la marca de un bulto (usuario y fecha en el bulto, sin generar factura) y
  // la refleja en el panel sin recargarlo.
  const applyMark = useCallback(async (bulto, marked) => {
    const res = await base44.functions.invoke('updateBulto', {
      bulto_id: bulto.id,
      billing_marked: !!marked,
    });
    if (res?.data?.error) throw new Error(res.data.error);
    const saved = res?.data?.bulto || {};
    setClients((prev) => prev.map((c) => ({
      ...c,
      bultos: (c.bultos || []).map((b) => (b.id === bulto.id
        ? {
          ...b,
          billing_marked: !!marked,
          billing_marked_by: saved.billing_marked_by || '',
          billing_marked_date: saved.billing_marked_date || null,
        }
        : b)),
    })));
  }, []);

  const markBulto = useCallback(async (bulto, marked) => {
    setMarkingId(bulto.id);
    try {
      await applyMark(bulto, marked);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e?.message || 'No se pudo guardar la marca' };
    } finally {
      setMarkingId(null);
    }
  }, [applyMark]);

  // Marca (o devuelve) de una vez todos los bultos de un N° de orden/envío. Se guarda
  // uno por uno con el mismo endpoint para respetar el marcado actual, avisando el
  // avance, y cada bulto confirmado se refleja de inmediato en el panel.
  const markBultos = useCallback(async (bultos, marked, onProgress) => {
    const list = (Array.isArray(bultos) ? bultos : []).filter((b) => b?.id);
    let done = 0;
    let failed = 0;
    for (const bulto of list) {
      try {
        await applyMark(bulto, marked);
        done += 1;
      } catch {
        failed += 1;
      }
      if (onProgress) onProgress(done + failed, list.length);
    }
    return { ok: failed === 0, count: done, failed, total: list.length };
  }, [applyMark]);

  return { clients, loading, error, reload: load, markBulto, markBultos, markingId };
}