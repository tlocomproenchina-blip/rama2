import { useState, useCallback, useRef } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';

// Intentos totales por foto (el original + 1 reintento automático).
const MAX_ATTEMPTS = 2;

/**
 * Hook compartido para subir la foto capturada automáticamente por el
 * BarcodeScannerModule en el instante de detectar un código.
 *
 * - handlePhotoCaptured(code, base64): callback para onPhotoCaptured del scanner.
 *   Inicia la subida a Bunny y guarda la promesa.
 * - waitForPhoto(code): espera a que la subida termine y devuelve la URL (o null).
 * - getPhotoStatus(code): 'uploading' | 'ready' | 'failed' | null.
 *   La foto NUNCA se descarta en silencio: si falla queda en 'failed' para que la
 *   pantalla avise y ofrezca reintentar o confirmar el guardado sin foto.
 * - retryPhoto(code): reintenta la subida de la foto ya capturada.
 */
export default function useScannedPhotoUploader() {
  const [photosByTracking, setPhotosByTracking] = useState({});
  const uploadPromisesRef = useRef({});
  const base64Ref = useRef({});
  const statusRef = useRef({});

  const setStatus = useCallback((code, value) => {
    statusRef.current = { ...statusRef.current, [code]: value };
    setPhotosByTracking((prev) => {
      const next = { ...prev };
      if (value) next[code] = value;
      else delete next[code];
      return next;
    });
  }, []);

  const upload = useCallback(async (code) => {
    const base64 = base64Ref.current[code];
    if (!base64) return null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const { data } = await base44.functions.invoke('uploadImageToBunny', { image_base64: base64 });
        if (data?.url) {
          setStatus(code, { status: 'ready', url: data.url });
          return data.url;
        }
      } catch (_) {
        // Se reintenta abajo
      }
      if (attempt < MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 900));
    }
    setStatus(code, { status: 'failed' });
    return null;
  }, [setStatus]);

  const handlePhotoCaptured = useCallback((code, base64) => {
    if (!code || !base64) return null;
    base64Ref.current = { ...base64Ref.current, [code]: base64 };
    setStatus(code, { status: 'uploading' });
    const promise = upload(code);
    uploadPromisesRef.current = { ...uploadPromisesRef.current, [code]: promise };
    return promise;
  }, [setStatus, upload]);

  const retryPhoto = useCallback(async (code) => {
    if (!code || !base64Ref.current[code]) return null;
    setStatus(code, { status: 'uploading' });
    const promise = upload(code);
    uploadPromisesRef.current = { ...uploadPromisesRef.current, [code]: promise };
    return await promise;
  }, [setStatus, upload]);

  const waitForPhoto = useCallback(async (code) => {
    const promise = uploadPromisesRef.current[code];
    if (promise) return await promise;
    return null;
  }, []);

  const getPhotoUrl = useCallback((code) => statusRef.current[code]?.url || null, []);
  const getPhotoStatus = useCallback((code) => statusRef.current[code]?.status || null, []);

  return { photosByTracking, handlePhotoCaptured, waitForPhoto, getPhotoUrl, getPhotoStatus, retryPhoto };
}