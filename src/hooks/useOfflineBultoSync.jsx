import { useEffect, useCallback, useRef } from 'react';
import { enqueue, on, retryAll } from '@/lib/storeForward/engine';
import { kindOf } from '@/lib/storeForward/handlers';
import { useStoreForwardQueue } from '@/hooks/useStoreForwardQueue';

// Cola de la Mesa de empaque sobre el Store and Forward de la bodega. Bultos y cajas
// cerrados, recepciones, fotos, impresiones y numeración de etiquetas se guardan
// primero en el teléfono con su hora real; el envío ocurre en segundo plano, aunque
// el operador esté en otra pantalla.

const MESA = new Set(['bulto', 'caja', 'package_reception', 'scan_photo', 'print_log', 'caja_labels']);
const isMesa = (item) => MESA.has(kindOf(item));
const newId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// onRelabeled(bulto): el servidor le dio otro código al bulto; se reimprime.
// onDuplicate(list): trackings omitidos porque ya estaban en otra unidad.
export function useOfflineBultoSync({ onRelabeled, onDuplicate } = {}) {
  const onRelabeledRef = useRef(onRelabeled);
  onRelabeledRef.current = onRelabeled;
  const onDuplicateRef = useRef(onDuplicate);
  onDuplicateRef.current = onDuplicate;

  useEffect(() => {
    const offA = on('relabeled', (b) => onRelabeledRef.current?.(b));
    const offB = on('duplicates', (list) => onDuplicateRef.current?.(list));
    return () => { offA(); offB(); };
  }, []);

  const { items, isSyncing, isOnline } = useStoreForwardQueue(isMesa);

  const enqueueClosedBulto = useCallback((bultoData) => enqueue({
    id: bultoData.local_bulto_id || newId('sync'),
    ...bultoData,
    type: 'bulto',
  }), []);

  const enqueueCaja = useCallback((cajaData) => enqueue({
    id: cajaData.local_bulto_id || newId('caja'),
    ...cajaData,
    type: 'caja',
  }), []);

  const enqueuePackageReception = useCallback((pkg) => {
    if (!pkg?.id) return null;
    return enqueue({
      id: `pkg_${pkg.id}`,
      type: 'package_reception',
      package_id: pkg.id,
      tracking_number: pkg.tracking_number || '',
      status: 'recibido',
      received_date: pkg.received_date || new Date().toISOString(),
      received_by: pkg.received_by || '',
    });
  }, []);

  // La foto se guarda aparte en el teléfono hasta que se pueda subir.
  const enqueueScanPhoto = useCallback(({ pkg, base64 }) => {
    if (!pkg?.id || !base64) return null;
    return enqueue({
      id: newId('photo'),
      type: 'scan_photo',
      package_id: pkg.id,
      tracking_number: pkg.tracking_number || '',
      image_base64: base64,
      captured_at: new Date().toISOString(),
    });
  }, []);

  // La impresión espera a que su unidad quede registrada.
  const enqueuePrintLogs = useCallback(async (list = []) => {
    const printedAt = new Date().toISOString();
    for (const it of list) {
      await enqueue({
        id: newId('print'),
        type: 'print_log',
        bulto_local_id: it.id,
        depends_on: it.id ? [it.id] : [],
        label_code: it.bulto_snapshot?.label_code || it.label_code || '',
        printed_at: printedAt,
      });
    }
  }, []);

  const enqueueCajaLabels = useCallback(({ clientEmail, cajas = [] }) => {
    if (!clientEmail || !cajas.length) return null;
    const printedAt = new Date().toISOString();
    return enqueue({
      id: newId('cajalabels'),
      type: 'caja_labels',
      client_email: clientEmail,
      assignments: cajas.map((c) => ({
        label_code: c.label_code,
        caja_number: c.caja_number,
        caja_total: c.caja_total,
        printed_at: printedAt,
      })),
    });
  }, []);

  const retrySync = useCallback(() => retryAll(isMesa), []);

  return {
    pendingBultos: items,
    isSyncing,
    isOnline,
    enqueueClosedBulto,
    enqueueCaja,
    enqueuePackageReception,
    enqueueScanPhoto,
    enqueuePrintLogs,
    enqueueCajaLabels,
    retrySync,
  };
}