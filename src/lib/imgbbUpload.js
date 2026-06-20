import { base44 } from '@/api/base44Client';

// Lee el archivo original como base64 (fallback seguro si la compresión falla)
const readAsBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1]);
  reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
  reader.readAsDataURL(file);
});

// Comprime la imagen en el navegador (máx 1600px, JPEG 80%) para que la subida sea rápida.
// Si algo falla o tarda demasiado, cae al archivo original en base64 (nunca se queda colgado).
const compressImage = (file) => new Promise((resolve) => {
  let settled = false;
  const finish = (value) => { if (!settled) { settled = true; resolve(value); } };
  const fallback = () => readAsBase64(file).then(finish).catch(() => finish(null));

  // Si en 8s no resolvió (onload/onerror nunca dispararon), usar el archivo original
  const timer = setTimeout(fallback, 8000);

  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    clearTimeout(timer);
    URL.revokeObjectURL(url);
    try {
      const maxDim = 1600;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      finish(dataUrl.split(',')[1]);
    } catch {
      fallback();
    }
  };
  img.onerror = () => {
    clearTimeout(timer);
    URL.revokeObjectURL(url);
    fallback();
  };
  img.src = url;
});

// Sube una imagen a ImgBB vía backend (0 créditos de integraciones). Devuelve la URL pública.
export async function uploadImageNoCredits(file) {
  const base64 = await compressImage(file);
  if (!base64) throw new Error('No se pudo procesar la imagen');

  // Timeout de red: si el backend no responde en 30s, cortar para no quedar colgado
  const invokePromise = base44.functions.invoke('uploadImageToImgbb', { image_base64: base64 });
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('La subida tardó demasiado. Revisa tu conexión e intenta de nuevo.')), 30000)
  );

  const { data } = await Promise.race([invokePromise, timeoutPromise]);
  if (!data?.url) throw new Error(data?.error || 'No se pudo subir la imagen');
  return data.url;
}