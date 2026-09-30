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

  // Marca a mano un bulto (su N° de orden/envío) como ya facturado: se guarda en el
  // bulto con usuario y fecha, y deja de ofrecerse como pendiente sin generar factura.
  const markBulto = useCallback(async (bulto, marked) => {
    setMarkingId(bulto.id);
    try {
      const res = await base44.functions.invoke('updateBulto', {
        bulto_id: bulto.id,
        billing_marked: !!marked,
      });
      if (res?.data?.error) throw new Error(res.data.error);
      // La marca no quita el bulto de la lista: se refleja en verde (o vuelve a su
      // estado normal al quitarla), sin recargar el panel.
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
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e?.message || 'No se pudo guardar la marca' };
    } finally {
      setMarkingId(null);
    }
  }, []);

  return { clients, loading, error, reload: load, markBulto, markingId };
}