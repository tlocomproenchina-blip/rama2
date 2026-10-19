// Lectura del código de la foto, en el servidor.
//
// La captura del almacén es una foto JPEG: aquí se decodifica el JPEG a píxeles y se
// leen los códigos con ZXing (misma familia de códigos que el escáner de la pantalla:
// Code128, Code39, EAN/UPC, ITF, QR y DataMatrix).
//
// Una etiqueta de envío llega de muchas formas: pequeña, encuadrada o al borde de la
// foto, vertical sobre la caja, con poco contraste o con el fondo del almacén de por
// medio. Por eso se insiste en varias pasadas sobre la misma foto, ordenadas por lo
// que resuelve más casos por menos trabajo:
//   1. búsqueda de códigos 2D (las etiquetas TLEC llevan QR) y lectura general en las
//      zonas donde el operador encuadra el paquete,
//   2. la foto completa y los cuadrantes con solape, por si la etiqueta quedó a un borde,
//   3. las regiones pequeñas se amplían (la etiqueta lejana llega con módulos muy finos),
//   4. una pasada con el contraste estirado (fotos oscuras o con luz despareja) y otra
//      con binarizador de histograma global,
//   5. la etiqueta en negativo (código claro sobre fondo oscuro).
// Si con todo eso no se obtiene un código se devuelve null: quien llama decide el
// respaldo (el código que leyó el teléfono o la lectura con visión de la IA).
import jpeg from 'npm:jpeg-js@0.4.4';
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  GlobalHistogramBinarizer,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from 'npm:@zxing/library@0.21.3';

const FORMATS = [
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.ITF,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.DATA_MATRIX,
];

// Los códigos 2D se leen sin importar cómo estén girados, así que se buscan primero.
const FORMATS_2D = [BarcodeFormat.QR_CODE, BarcodeFormat.DATA_MATRIX];

// Presupuesto de lectura de una captura: agotado, se sigue con el respaldo (teléfono
// o IA) en vez de dejar el trabajo colgado.
const DECODE_BUDGET_MS = 15000;
// Lado mayor al que se lleva una región pequeña antes de leerla.
const TARGET_REGION_PX = 1100;
// Tope de píxeles por región para no ampliar una foto que ya es grande.
const MAX_REGION_PIXELS = 1600000;

export type BarcodeRead = { code: string; format: string; reliable: boolean };

type Area = { x: number; y: number; w: number; h: number };
type Luminance = { lum: Uint8ClampedArray; w: number; h: number };

// Un código de producto (EAN/UPC de 8 a 13 dígitos) identifica mercancía, no un envío:
// se puede leer, pero no sirve para dar de alta una carga con él.
export function isProductCodeShape(code: string): boolean {
  return /^\d{8,13}$/.test(String(code || '').trim());
}

// Un código sirve como tracking cuando parece el código de un envío y no el contenido
// de un QR ajeno al paquete (una dirección web, una frase): con cuerpo suficiente, sin
// espacios y sin forma de dirección.
export function isTrackingShape(code: string): boolean {
  const value = String(code || '').trim();
  if (value.length < 6 || value.length > 40) return false;
  if (/\s/.test(value)) return false;
  if (/^(https?|www\.)/i.test(value) || value.includes('://')) return false;
  return /^[0-9A-Za-z][0-9A-Za-z.,\-_/:#]*$/.test(value);
}

// Una lectura es confiable cuando quien llama puede dar de alta la carga con ella:
// el código tiene forma de tracking y su formato trae verificación propia (los 2D con
// corrección de errores, los 1D que ZXing valida por checksum). Code39 y Codabar no
// verifican nada, y un código de producto no es un envío.
function classify(code: string, format: string): BarcodeRead {
  const clean = String(code || '').trim();
  const reliable = isTrackingShape(clean)
    && format !== 'CODE_39'
    && format !== 'CODABAR'
    && !isProductCodeShape(clean);
  return { code: clean, format, reliable };
}

// Zonas que se recorren, en orden: donde el operador encuadra el paquete, la foto
// completa y los cuadrantes con solape (etiqueta hacia un borde).
function scanAreas(width: number, height: number): Area[] {
  const areas: Area[] = [];

  for (const margin of [0.08, 0.2]) {
    const w = Math.round(width * (1 - 2 * margin));
    const h = Math.round(height * (1 - 2 * margin));
    if (w >= 120 && h >= 120) areas.push({ x: Math.round(width * margin), y: Math.round(height * margin), w, h });
  }

  areas.push({ x: 0, y: 0, w: width, h: height });

  const qw = Math.round(width * 0.6);
  const qh = Math.round(height * 0.6);
  if (qw >= 120 && qh >= 120) {
    for (const x of [0, width - qw]) {
      for (const y of [0, height - qh]) areas.push({ x, y, w: qw, h: qh });
    }
  }

  return areas;
}

// Luminancia (escala de grises) del área pedida, que es lo que espera ZXing.
function luminanceArea(rgba: Uint8Array, width: number, area: Area): Luminance {
  const lum = new Uint8ClampedArray(area.w * area.h);
  for (let row = 0; row < area.h; row++) {
    const src = ((area.y + row) * width + area.x) * 4;
    const dst = row * area.w;
    for (let col = 0; col < area.w; col++) {
      const i = src + col * 4;
      lum[dst + col] = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000;
    }
  }
  return { lum, w: area.w, h: area.h };
}

// Región lista para leer: la etiqueta lejana llega con los módulos del código muy
// finos, así que las regiones pequeñas se amplían antes de buscar.
function prepareRegion(rgba: Uint8Array, width: number, area: Area): Luminance {
  const base = luminanceArea(rgba, width, area);
  const larger = Math.max(base.w, base.h);
  const factor = Math.min(2, TARGET_REGION_PX / larger);
  if (!(factor > 1.15)) return base;
  if (base.w * base.h * factor * factor > MAX_REGION_PIXELS) return base;
  return upscale(base, factor);
}

// Ampliación con interpolación: suaviza los bordes del código, que es lo que el lector
// necesita para separar barras de un solo píxel.
function upscale({ lum, w, h }: Luminance, factor: number): Luminance {
  const nw = Math.round(w * factor);
  const nh = Math.round(h * factor);
  const out = new Uint8ClampedArray(nw * nh);
  for (let y = 0; y < nh; y++) {
    const sy = y / factor;
    const y0 = Math.min(h - 1, Math.floor(sy));
    const y1 = Math.min(h - 1, y0 + 1);
    const fy = sy - y0;
    for (let x = 0; x < nw; x++) {
      const sx = x / factor;
      const x0 = Math.min(w - 1, Math.floor(sx));
      const x1 = Math.min(w - 1, x0 + 1);
      const fx = sx - x0;
      const top = lum[y0 * w + x0] * (1 - fx) + lum[y0 * w + x1] * fx;
      const bottom = lum[y1 * w + x0] * (1 - fx) + lum[y1 * w + x1] * fx;
      out[y * nw + x] = top * (1 - fy) + bottom * fy;
    }
  }
  return { lum: out, w: nw, h: nh };
}

// Estira el histograma de la región (2% a 98% de los tonos) para rescatar fotos
// oscuras, con reflejo o con la luz del almacén muy despareja.
function stretch({ lum, w, h }: Luminance): Luminance {
  const hist = new Uint32Array(256);
  for (let i = 0; i < lum.length; i++) hist[lum[i]]++;

  const lowTarget = lum.length * 0.02;
  const highTarget = lum.length * 0.98;
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
  const out = new Uint8ClampedArray(lum.length);
  for (let i = 0; i < lum.length; i++) out[i] = ((lum[i] - low) * 255) / span;
  return { lum: out, w, h };
}

// Etiqueta en negativo: código claro sobre fondo oscuro.
function invert({ lum, w, h }: Luminance): Luminance {
  const out = new Uint8ClampedArray(lum.length);
  for (let i = 0; i < lum.length; i++) out[i] = 255 - lum[i];
  return { lum: out, w, h };
}

// La etiqueta suele venir girada sobre la caja: se prueba la imagen tal cual y
// girada, porque el lector de códigos lineales no gira solo.
function rotate({ lum, w, h }: Luminance, degrees: number): Luminance {
  if (degrees === 0) return { lum, w, h };

  const out = new Uint8ClampedArray(lum.length);
  if (degrees === 90) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) out[x * h + (h - 1 - y)] = lum[y * w + x];
    }
    return { lum: out, w: h, h: w };
  }
  if (degrees === 180) {
    for (let i = 0; i < lum.length; i++) out[i] = lum[lum.length - 1 - i];
    return { lum: out, w, h };
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) out[(w - 1 - x) * h + y] = lum[y * w + x];
  }
  return { lum: out, w: h, h: w };
}

function makeReader(formats: number[]) {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new MultiFormatReader();
  reader.setHints(hints);
  return reader;
}

export async function decodeBarcodeFromUrl(
  url: string,
  { budgetMs = DECODE_BUDGET_MS }: { budgetMs?: number } = {},
): Promise<BarcodeRead | null> {
  if (!url) return null;

  let pixels: { width: number; height: number; data: Uint8Array };
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const image = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true, tolerantDecoding: true });
    if (!image?.width || !image?.height || !image?.data) return null;
    pixels = { width: image.width, height: image.height, data: image.data as Uint8Array };
  } catch (_) {
    // Foto que no se pudo descargar o que no es un JPEG legible.
    return null;
  }

  const deadline = Date.now() + budgetMs;
  const reader2D = makeReader(FORMATS_2D);
  const readerAll = makeReader(FORMATS);

  const tryDecode = (reader: any, source: Luminance, binarizer: 'hybrid' | 'global'): BarcodeRead | null => {
    try {
      const luminanceSource = new RGBLuminanceSource(source.lum, source.w, source.h);
      const bin = binarizer === 'global'
        ? new GlobalHistogramBinarizer(luminanceSource)
        : new HybridBinarizer(luminanceSource);
      const result = reader.decode(new BinaryBitmap(bin));
      const text = String(result?.getText?.() || '').trim();
      if (!text) return null;
      return classify(text, BarcodeFormat[result.getBarcodeFormat()] || 'desconocido');
    } catch (_) {
      // Zona sin código legible: se prueba la siguiente.
      return null;
    }
  };

  const regions = scanAreas(pixels.width, pixels.height)
    .map((area) => prepareRegion(pixels.data, pixels.width, area));

  // 1) Primera pasada: los códigos 2D (QR y DataMatrix, los que llevan las etiquetas
  //    TLEC) y la lectura general con la etiqueta tal cual y girada.
  for (const region of regions) {
    const quick = tryDecode(reader2D, region, 'hybrid');
    if (quick) return quick;
    for (const degrees of [0, 90, 270, 180]) {
      const read = tryDecode(readerAll, rotate(region, degrees), 'hybrid');
      if (read) return read;
      if (Date.now() > deadline) return null;
    }
  }

  // 2) Segunda pasada: el contraste estirado, que es lo que rescata las fotos oscuras
  //    o con la luz del almacén muy despareja.
  for (const region of regions) {
    const sharp = stretch(region);
    for (const degrees of [0, 90, 270, 180]) {
      const read = tryDecode(readerAll, rotate(sharp, degrees), 'hybrid');
      if (read) return read;
      if (Date.now() > deadline) return null;
    }
    const quick = tryDecode(reader2D, sharp, 'hybrid');
    if (quick) return quick;
  }

  // 3) Tercera pasada: binarizador de histograma global, otra forma de separar el
  //    código del fondo cuando el gris de la foto no ayuda.
  for (const region of regions) {
    for (const degrees of [0, 90, 270]) {
      const read = tryDecode(readerAll, rotate(region, degrees), 'global');
      if (read) return read;
      if (Date.now() > deadline) return null;
    }
  }

  // 4) Cuarta pasada: etiqueta en negativo.
  for (const region of regions) {
    const read = tryDecode(reader2D, invert(region), 'hybrid');
    if (read) return read;
    if (Date.now() > deadline) return null;
  }

  return null;
}