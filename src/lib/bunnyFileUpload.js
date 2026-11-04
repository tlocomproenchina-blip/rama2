// Subida de una imagen (File) a Bunny a través de la función uploadImageToBunny.
// Recibe la función invoke del cliente para no importar el cliente (evita ciclos).

export const isImageFile = (file) =>
  file instanceof Blob && String(file.type || '').toLowerCase().startsWith('image/');

const extOf = (file) => {
  const sub = String(file.type || '').toLowerCase().split('/')[1] || '';
  if (sub === 'jpeg') return 'jpg';
  if (sub === 'svg+xml') return 'svg';
  return /^[a-z0-9]{2,5}$/.test(sub) ? sub : 'jpg';
};

const readAsBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1]);
  reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
  reader.readAsDataURL(file);
});

const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error('La subida tardó demasiado. Revisa tu conexión e intenta de nuevo.')), ms)),
]);

// Devuelve la URL pública de Bunny. Reintenta una vez antes de fallar.
export async function uploadFileToBunny(file, invoke) {
  const image_base64 = await readAsBase64(file);
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await withTimeout(invoke('uploadImageToBunny', { image_base64, ext: extOf(file) }), 45000);
      const url = res?.data?.url;
      if (typeof url === 'string' && url.startsWith('https://')) return url;
      lastError = new Error(res?.data?.error || 'No se pudo subir la imagen');
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('No se pudo subir la imagen');
}