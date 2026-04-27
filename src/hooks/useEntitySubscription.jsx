import { useEffect, useRef } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';

/**
 * Hook centralizado para suscribirse a cambios en una entidad de Base44.
 *
 * Maneja por defecto:
 * - Cleanup automático del unsubscribe
 * - Flag isMounted para evitar setState en componentes desmontados
 * - Filtro opcional para descartar eventos irrelevantes (ej: notificaciones de otro usuario)
 * - Debounce opcional para agrupar ráfagas de eventos en una sola llamada
 *
 * @param {string} entityName     Nombre de la entidad (ej: 'Notification', 'Package')
 * @param {Function} onEvent      Callback (event) => void. event = { type, id, data }
 * @param {Object} options
 * @param {boolean} options.enabled    Si false, no se suscribe (default true)
 * @param {Function} options.filter    (event) => boolean — si retorna false, ignora el evento
 * @param {number} options.debounceMs  Si se define, agrupa eventos y llama una sola vez tras X ms
 * @param {Array} deps                 Dependencias para re-suscribir (similar a useEffect)
 */
export default function useEntitySubscription(entityName, onEvent, options = {}, deps = []) {
  const { enabled = true, filter, debounceMs } = options;
  const onEventRef = useRef(onEvent);
  const filterRef = useRef(filter);

  // Mantener referencias actualizadas sin re-suscribir
  useEffect(() => { onEventRef.current = onEvent; }, [onEvent]);
  useEffect(() => { filterRef.current = filter; }, [filter]);

  useEffect(() => {
    if (!enabled || !entityName) return;

    let isMounted = true;
    let debounceTimer;
    let lastEvent = null;

    const handler = (event) => {
      if (!isMounted) return;
      if (filterRef.current && !filterRef.current(event)) return;

      if (debounceMs && debounceMs > 0) {
        lastEvent = event;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (isMounted && onEventRef.current) onEventRef.current(lastEvent);
        }, debounceMs);
      } else if (onEventRef.current) {
        onEventRef.current(event);
      }
    };

    let unsubscribe = () => {};
    try {
      unsubscribe = base44.entities[entityName].subscribe(handler);
    } catch (_) {}

    return () => {
      isMounted = false;
      clearTimeout(debounceTimer);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityName, enabled, debounceMs, ...deps]);
}