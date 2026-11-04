// Compresión equilibrada de imágenes antes de subirlas. Conserva las dimensiones
// originales (sin redimensionar) y la orientación de la foto. PNG, GIF y SVG se
// dejan intactos para no perder transparencia, animación o vectores; los
// archivos que no son imágenes nunca se tocan.
export const IMAGE_QUALITY = 0.75;

const SKIP_TYPES = ['image/png', 'image/gif', 'image/svg+xml'];
const TIMEOUT_MS = 10000;

const loadImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  const timer = setTimeout(() => { URL.revokeObjectURL(url); reject(new Error('timeout')); }, TIMEOUT_MS);
  img.onload = () => { clearTimeout(timer); URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { clearTimeout(timer); URL.revokeObjectURL(url); reject(new Error('decode')); };
  img.src = url;
});

const canvasToBlob = (canvas, type) => new Promise((resolve) => {
  canvas.toBlob((blob) => resolve(blob), type, IMAGE_QUALITY);
});

// Devuelve un File comprimido, o el original si no es imagen, no conviene
// comprimirla o el resultado no pesa menos.
export async function compressImageFile(file) {
  if (!(file instanceof Blob)) return file;
  const type = String(file.type || '').toLowerCase();
  if (!type.startsWith('image/') || SKIP_TYPES.includes(type)) return file;
  try {
    const img = await loadImage(file);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    const outType = type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const blob = await canvasToBlob(canvas, outType);
    if (!blob || blob.size >= file.size) return file;
    const ext = outType === 'image/webp' ? 'webp' : 'jpg';
    const baseName = String(file.name || 'imagen').replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.${ext}`, { type: outType, lastModified: Date.now() });
  } catch (_) {
    return file;
  }
}

// Comprime los File que vengan en el payload de una carga (ej. { file }).
export async function compressUploadPayload(data) {
  if (!data || typeof data !== 'object' || data instanceof FormData) return data;
  const entries = await Promise.all(
    Object.entries(data).map(async ([key, value]) => [key, value instanceof File ? await compressImageFile(value) : value])
  );
  return Object.fromEntries(entries);
}