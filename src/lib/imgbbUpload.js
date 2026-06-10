import { base44 } from '@/api/base44Client';

// Comprime la imagen en el navegador (máx 1600px, JPEG 80%) para que la subida sea rápida
const compressImage = (file) => new Promise((resolve) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    URL.revokeObjectURL(url);
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
    resolve(dataUrl.split(',')[1]);
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    // Si no se puede comprimir, enviar el archivo original en base64
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(file);
  };
  img.src = url;
});

// Sube una imagen a ImgBB vía backend (0 créditos de integraciones). Devuelve la URL pública.
export async function uploadImageNoCredits(file) {
  const base64 = await compressImage(file);
  const { data } = await base44.functions.invoke('uploadImageToImgbb', { image_base64: base64 });
  if (!data?.url) throw new Error(data?.error || 'No se pudo subir la imagen');
  return data.url;
}