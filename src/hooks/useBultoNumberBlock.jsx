import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { getActiveBlock, saveBlock, reserveBultoNumber, remainingInBlock } from '@/lib/offlineDb';

const DEVICE_ID_KEY = 'tlec_warehouse_device_id';

// Hook que gestiona la reserva de bloques de números de bulto.
// Al montar (o al agotarse el bloque), pide al servidor un bloque de 50 números.
// Almacena el bloque en IndexedDB y asigna números localmente (offline).
// Si quedan <10 números, pre-reserva el siguiente bloque en segundo plano.

function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = 'dev_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch (_) {
    return 'dev_fallback';
  }
}

export function useBultoNumberBlock() {
  const [block, setBlock] = useState(null);
  const [reserving, setReserving] = useState(false);
  const [error, setError] = useState(null);
  const reservingRef = useRef(false);
  const deviceIdRef = useRef(getDeviceId());

  // Reservar un bloque del servidor
  const reserveBlock = useCallback(async () => {
    if (reservingRef.current) return null;
    reservingRef.current = true;
    setReserving(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('reserveBultoNumberBlock', {
        block_size: 50,
        device_id: deviceIdRef.current,
      });
      const data = res?.data;
      if (!data || !data.start) {
        throw new Error('Respuesta inválida del servidor');
      }
      const newBlock = {
        id: data.block_id,
        start: data.start,
        end: data.end,
        next_number: data.start,
        status: 'active',
        reserved_at: Date.now(),
      };
      await saveBlock(newBlock);
      setBlock(newBlock);
      return newBlock;
    } catch (e) {
      setError(e?.message || 'No se pudo reservar el bloque de números');
      return null;
    } finally {
      setReserving(false);
      reservingRef.current = false;
    }
  }, []);

  // Al montar: cargar bloque activo de IndexedDB; si no hay, reservar uno
  useEffect(() => {
    (async () => {
      const active = await getActiveBlock();
      if (active && active.status === 'active' && active.next_number <= active.end) {
        setBlock(active);
        // Pre-reservar si quedan pocos
        const remaining = await remainingInBlock();
        if (remaining < 10) {
          reserveBlock(); // background, no await
        }
      } else {
        await reserveBlock();
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Obtener el siguiente número de bulto (offline)
  const getNextNumber = useCallback(async () => {
    // Intentar reservar del bloque actual
    let num = await reserveBultoNumber();
    if (num) {
      // Actualizar estado local del bloque
      const active = await getActiveBlock();
      setBlock(active);
      // Pre-reservar si quedan pocos
      const remaining = await remainingInBlock();
      if (remaining < 10) {
        reserveBlock(); // background
      }
      return num;
    }
    // Bloque agotado o sin bloque: intentar reservar uno nuevo (requiere conexión)
    const newBlock = await reserveBlock();
    if (newBlock) {
      const num2 = await reserveBultoNumber();
      if (num2) {
        const active = await getActiveBlock();
        setBlock(active);
        return num2;
      }
    }
    return null;
  }, [reserveBlock]);

  return {
    block,
    reserving,
    error,
    getNextNumber,
    reserveBlock,
  };
}