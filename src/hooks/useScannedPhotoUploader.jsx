import { useState, useCallback, useRef } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';

/**
 * Hook compartido para subir la foto capturada automáticamente por el
 * BarcodeScannerModule en el instante de detectar un código.
 *
 * - handlePhotoCaptured(code, base64): callback para onPhotoCaptured del scanner.
 *   Inicia la subida a ImgBB en segundo plano y guarda la promesa.
 * - waitForPhoto(code): espera a que la subida termine y devuelve la URL (o null).
 *   Se llama antes de enviar la recepción/despacho para asegurar que la foto
 *   ya esté subida.
 * - getPhotoUrl(code): devuelve la URL si ya está lista (sin esperar).
 */
export default function useScannedPhotoUploader() {
  const [photosByTracking, setPhotosByTracking] = useState({});
  const uploadPromisesRef = useRef({});

  const handlePhotoCaptured = useCallback((code, base64) => {
    if (!code || !base64) return;
    setPhotosByTracking((prev) => ({ ...prev, [code]: { status: 'uploading' } }));
    const promise = (async () => {
      try {
        const { data } = await base44.functions.invoke('uploadImageToImgbb', { image_base64: base64 });
        if (data?.url) {
          setPhotosByTracking((prev) => ({ ...prev, [code]: { status: 'ready', url: data.url } }));
          return data.url;
        }
        setPhotosByTracking((prev) => { const c = { ...prev }; delete c[code]; return c; });
        return null;
      } catch (_) {
        setPhotosByTracking((prev) => { const c = { ...prev }; delete c[code]; return c; });
        return null;
      }
    })();
    uploadPromisesRef.current[code] = promise;
    return promise;
  }, []);

  const waitForPhoto = useCallback(async (code) => {
    const promise = uploadPromisesRef.current[code];
    if (promise) return await promise;
    return null;
  }, []);

  const getPhotoUrl = useCallback((code) => photosByTracking[code]?.url || null, [photosByTracking]);

  return { photosByTracking, handlePhotoCaptured, waitForPhoto, getPhotoUrl };
}