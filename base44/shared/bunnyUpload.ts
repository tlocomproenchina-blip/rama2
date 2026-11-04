// Subida de imágenes a Bunny Storage. Un solo punto de subida, compartido por la
// función uploadImageToBunny y por la captura del escáner de bodega, para que la
// foto se guarde siempre igual (mismo formato, misma validación de la URL final).

// Error con el código HTTP que le corresponde, para que cada función responda con
// el mismo detalle que antes (configuración rota ≠ Bunny rechazando la subida).
export class BunnyUploadError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'BunnyUploadError';
    this.status = status;
  }
}

export async function uploadBase64ToBunny(imageBase64: string, ext = 'jpg'): Promise<string> {
  if (!imageBase64) throw new BunnyUploadError('image_base64 es requerido', 400);
  const binary = atob(imageBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return uploadBytesToBunny(bytes, ext);
}

// Extensión de archivo a partir del tipo de imagen (image/png → png).
export function extFromContentType(type: string, fallback = 'jpg'): string {
  const sub = String(type || '').toLowerCase().split(';')[0].split('/')[1] || '';
  if (sub === 'jpeg' || sub === 'pjpeg') return 'jpg';
  if (sub === 'svg+xml') return 'svg';
  return /^[a-z0-9]{2,5}$/.test(sub) ? sub : fallback;
}

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|bmp|heic|heif|svg|avif|tiff?)$/i;

// Descarga una imagen desde un enlace y la copia a Bunny. Devuelve null si el
// archivo no es una imagen (PDF, Excel…), para dejarlo donde está.
export async function copyUrlToBunny(url: string, nameHint = ''): Promise<string | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new BunnyUploadError(`No se pudo descargar la imagen (${res.status})`, 502);
  const type = res.headers.get('content-type') || '';
  const path = String(nameHint || url).split('?')[0];
  const extMatch = path.match(IMAGE_EXT_RE);
  if (!type.startsWith('image/') && !extMatch) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  const ext = type.startsWith('image/')
    ? extFromContentType(type)
    : extMatch![1].toLowerCase().replace('jpeg', 'jpg');
  return uploadBytesToBunny(bytes, ext);
}

export async function uploadBytesToBunny(bytes: Uint8Array, ext = 'jpg'): Promise<string> {
  if (!bytes?.length) throw new BunnyUploadError('La imagen está vacía', 400);

  const storageKey = Deno.env.get('BUNNY_STORAGE_KEY');
  const storageZone = Deno.env.get('BUNNY_STORAGE_ZONE');
  // Normalizar el host del CDN: puede venir con "https://" y/o con barra final,
  // lo que generaba enlaces con doble barra que no cargaban la foto.
  const cdnHost = String(Deno.env.get('BUNNY_CDN_HOST') || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');

  if (!storageKey || !storageZone || !cdnHost) {
    throw new BunnyUploadError('Falta configuración de Bunny (key/zone/cdn host)', 500);
  }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(cdnHost)) {
    throw new BunnyUploadError('BUNNY_CDN_HOST inválido (solo el dominio, sin https:// ni barra final)', 500);
  }

  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  const safeExt = /^[a-z0-9]{2,5}$/i.test(ext) ? ext.toLowerCase() : 'jpg';
  const path = `tlec/${ts}-${rand}.${safeExt}`;

  const res = await fetch(`https://storage.bunnycdn.com/${storageZone}/${path}`, {
    method: 'PUT',
    headers: {
      'AccessKey': storageKey,
      'Content-Type': 'application/octet-stream',
    },
    body: bytes,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new BunnyUploadError(`Error subiendo a Bunny (${res.status}): ${errText}`, 502);
  }

  const publicUrl = `https://${cdnHost}/${path}`;
  // Validar la URL antes de entregarla: si queda mal formada, el paquete se
  // guardaría con una foto que nunca carga.
  try {
    const parsed = new URL(publicUrl);
    if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.pathname.startsWith('//')) {
      throw new BunnyUploadError('URL de foto inválida', 500);
    }
  } catch (err) {
    throw err instanceof BunnyUploadError ? err : new BunnyUploadError('URL de foto inválida', 500);
  }

  return publicUrl;
}