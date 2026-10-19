// Lectura del código de barras de la foto, en el servidor.
//
// La captura del almacén es una foto JPEG: aquí se decodifica el JPEG a píxeles y
// se leen los códigos con ZXing (misma familia de códigos que el escáner de la
// pantalla: Code128, Code39, EAN/UPC, ITF, QR y DataMatrix).
//
// Una etiqueta de envío llega de muchas formas: encuadrada o al borde de la foto,
// vertical sobre la caja, con poco contraste o con el fondo del almacén de por
// medio. Por eso se insiste en varias pasadas sobre la misma foto:
//   1. búsqueda por regiones (imagen completa, centro y cuadrantes con solape),
//   2. la etiqueta girada (90°, 180° y 270°),
//   3. un binarizador de histograma global para fotos de bajo contraste.
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

type Area = { x: number; y: number; w: number; h: number };
type Luminance = { lum: Uint8ClampedArray; w: number; h: number };

// Zonas que se recorren en cada pasada: la foto completa, dos recortes centrados
// (donde el operador encuadra el paquete) y los cuadrantes con solape, por si la
// etiqueta quedó hacia un borde.
function scanAreas(width: number, height: number): Area[] {
  const areas: Area[] = [{ x: 0, y: 0, w: width, h: height }];

  for (const margin of [0.12, 0.26]) {
    const w = Math.round(width * (1 - 2 * margin));
    const h = Math.round(height * (1 - 2 * margin));
    if (w >= 120 && h >= 120) areas.push({ x: Math.round(width * margin), y: Math.round(height * margin), w, h });
  }

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

export type BarcodeRead = { code: string; format: string };

export async function decodeBarcodeFromUrl(url: string): Promise<BarcodeRead | null> {
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

  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATS);
  hints.set(DecodeHintType.TRY_HARDER, true);

  const reader = new MultiFormatReader();
  reader.setHints(hints);

  const regions = scanAreas(pixels.width, pixels.height).map((area) => luminanceArea(pixels.data, pixels.width, area));

  const tryDecode = (source: Luminance, binarizer: 'hybrid' | 'global'): BarcodeRead | null => {
    try {
      const bin = binarizer === 'global' ? new GlobalHistogramBinarizer(new RGBLuminanceSource(source.lum, source.w, source.h))
        : new HybridBinarizer(new RGBLuminanceSource(source.lum, source.w, source.h));
      const result = reader.decode(new BinaryBitmap(bin));
      const code = String(result?.getText?.() || '').trim();
      if (!code) return null;
      return { code, format: BarcodeFormat[result.getBarcodeFormat()] || 'desconocido' };
    } catch (_) {
      // Zona sin código legible: se prueba la siguiente.
      return null;
    }
  };

  // 1) Pasada normal, con la foto tal cual y con la etiqueta girada.
  for (const region of regions) {
    for (const degrees of [0, 90, 270, 180]) {
      const read = tryDecode(rotate(region, degrees), 'hybrid');
      if (read) return read;
    }
  }

  // 2) Segunda pasada, con binarizador de histograma global: rescata fotos de bajo
  //    contraste o con la luz del almacén muy despareja.
  for (const region of regions.slice(1)) {
    for (const degrees of [0, 90, 270]) {
      const read = tryDecode(rotate(region, degrees), 'global');
      if (read) return read;
    }
  }

  return null;
}