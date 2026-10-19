// Pre-procesamiento de la foto antes de la lectura con visión.
//
// El modelo de visión recibía la foto tal como salió del teléfono: a color, con la luz
// del almacén, con sombras y con el número del tracking muchas veces pequeño en el
// encuadre. El reconocimiento de texto mejora cuando la imagen llega en escala de
// grises, con el contraste estirado (el texto queda negro sobre blanco) y con el lado
// mayor dentro de un tamaño parejo, que es donde el modelo mira el detalle.
//
// Todo se hace en el servidor y se devuelve la imagen ya lista para viajar en la misma
// petición a la API: no se vuelve a subir nada al almacenamiento.
import jpeg from 'npm:jpeg-js@0.4.4';

// El tamaño solo se corrige cuando hace falta: las capturas del almacén ya llegan en
// un tamaño que el modelo mira bien (unos 1280 px), así que en el uso diario la foto no
// se toca; una captura muy chica se amplía para que el texto no llegue diminuto y una
// foto enorme se reduce, porque el proveedor la reduce igual y solo hace lenta la
// petición.
const MAX_SIDE_PX = 2048;
const MIN_SIDE_PX = 900;
// Tope de píxeles de la foto original: una foto enorme no se procesa y se manda el
// enlace original, para no cargar la memoria del servidor con capturas gigantes.
const MAX_PIXELS = 24000000;
// Calidad del JPEG de salida: alta, porque de aquí sale el texto que lee el modelo.
const JPEG_QUALITY = 92;

// Ampliación o reducción necesaria para dejar el lado mayor en el rango útil.
function targetScale(width: number, height: number): number {
  const longest = Math.max(width, height);
  if (longest > MAX_SIDE_PX) return MAX_SIDE_PX / longest;
  if (longest < MIN_SIDE_PX) return Math.min(2, MIN_SIDE_PX / longest);
  return 1;
}

// Luminancia de un píxel de la foto original (canales R, G y B).
function luminance(src: Uint8Array, width: number, x: number, y: number): number {
  const p = (y * width + x) * 4;
  return (src[p] * 299 + src[p + 1] * 587 + src[p + 2] * 114) / 1000;
}

// Pasa la foto a escala de grises y al tamaño pedido en una sola pasada, mezclando los
// píxeles vecinos: al reducir no se pierden los trazos finos del texto y al ampliar no
// quedan bordes duros que el modelo lee peor.
function toGrayResized(src: Uint8Array, sw: number, sh: number, dw: number, dh: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(dw * dh * 4);
  const fx = sw / dw;
  const fy = sh / dh;

  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, Math.max(0, (y + 0.5) * fy - 0.5));
    const y0 = Math.floor(sy);
    const y1 = Math.min(sh - 1, y0 + 1);
    const wy = sy - y0;

    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, Math.max(0, (x + 0.5) * fx - 0.5));
      const x0 = Math.floor(sx);
      const x1 = Math.min(sw - 1, x0 + 1);
      const wx = sx - x0;

      const l00 = luminance(src, sw, x0, y0);
      const l10 = luminance(src, sw, x1, y0);
      const l01 = luminance(src, sw, x0, y1);
      const l11 = luminance(src, sw, x1, y1);
      const top = l00 + (l10 - l00) * wx;
      const bottom = l01 + (l11 - l01) * wx;

      const i = (y * dw + x) * 4;
      out[i] = out[i + 1] = out[i + 2] = top + (bottom - top) * wy;
      out[i + 3] = 255;
    }
  }

  return out;
}

// Estira el histograma (2% a 98% de los tonos) para que el texto quede negro sobre
// blanco: es lo que rescata las fotos oscuras, con reflejo o con luz despareja.
function stretchContrast(rgba: Uint8ClampedArray): void {
  const hist = new Uint32Array(256);
  for (let i = 0; i < rgba.length; i += 4) hist[rgba[i]]++;

  const pixels = rgba.length / 4;
  const lowTarget = pixels * 0.02;
  const highTarget = pixels * 0.98;

  let acc = 0;
  let low = 0;
  let high = 255;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= lowTarget) {
      low = v;
      break;
    }
  }
  acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= highTarget) {
      high = v;
      break;
    }
  }

  const span = Math.max(1, high - low);
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = ((v - low) * 255) / span;

  for (let i = 0; i < rgba.length; i += 4) {
    const g = lut[rgba[i]];
    rgba[i] = g;
    rgba[i + 1] = g;
    rgba[i + 2] = g;
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x2000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// Foto preparada para el modelo: escala de grises, contraste estirado y tamaño parejo,
// lista como data URL. Devuelve cadena vacía cuando no se pudo preparar (foto que no
// se descarga, que no es JPEG legible o demasiado grande): quien llama decide si manda
// el enlace original.
export async function prepareImageForAI(url: string): Promise<string> {
  if (!url) return '';

  try {
    const res = await fetch(url);
    if (!res.ok) return '';
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length) return '';

    const image = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true, tolerantDecoding: true });
    if (!image?.width || !image?.height || !image?.data) return '';
    if (image.width * image.height > MAX_PIXELS) return '';

    const scale = targetScale(image.width, image.height);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const gray = toGrayResized(image.data as Uint8Array, image.width, image.height, width, height);
    stretchContrast(gray);

    const encoded: any = jpeg.encode({ data: gray, width, height }, JPEG_QUALITY);
    if (!encoded?.data?.length) return '';

    return `data:image/jpeg;base64,${toBase64(encoded.data as Uint8Array)}`;
  } catch (_) {
    return '';
  }
}