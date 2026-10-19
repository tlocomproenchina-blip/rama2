// Lectura del código de barras de la foto, en el servidor.
//
// La captura del almacén es una foto JPEG: aquí se decodifica el JPEG a píxeles y
// se leen los códigos con ZXing (misma familia de códigos que el escáner de la
// pantalla: Code128, Code39, EAN/UPC, ITF, QR y DataMatrix).
//
// Se prueban la imagen completa y dos recortes centrados: el operador encuadra el
// paquete en el centro de la pantalla, así que el código suele estar ahí y el
// recorte evita que el fondo del almacén ensucie la lectura.
//
// Si no se obtiene ningún código se devuelve null: quien llama decide el respaldo
// (el código que leyó el teléfono o la lectura con visión de la IA).
import jpeg from 'npm:jpeg-js@0.4.4';
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
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

// Zonas que se intentan, en orden: la foto completa y dos recortes centrados.
function scanAreas(width: number, height: number): Area[] {
  const areas: Area[] = [{ x: 0, y: 0, w: width, h: height }];
  for (const margin of [0.12, 0.26]) {
    const w = Math.round(width * (1 - 2 * margin));
    const h = Math.round(height * (1 - 2 * margin));
    if (w < 80 || h < 80) continue;
    areas.push({ x: Math.round(width * margin), y: Math.round(height * margin), w, h });
  }
  return areas;
}

// Luminancia (escala de grises) del área pedida, que es lo que espera ZXing.
function luminanceArea(rgba: Uint8Array, width: number, area: Area): Uint8ClampedArray {
  const lum = new Uint8ClampedArray(area.w * area.h);
  for (let row = 0; row < area.h; row++) {
    const src = ((area.y + row) * width + area.x) * 4;
    const dst = row * area.w;
    for (let col = 0; col < area.w; col++) {
      const i = src + col * 4;
      lum[dst + col] = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000;
    }
  }
  return lum;
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

  for (const area of scanAreas(pixels.width, pixels.height)) {
    try {
      const source = new RGBLuminanceSource(luminanceArea(pixels.data, pixels.width, area), area.w, area.h);
      const result = reader.decode(new BinaryBitmap(new HybridBinarizer(source)));
      const code = String(result?.getText?.() || '').trim();
      if (code) {
        const format = BarcodeFormat[result.getBarcodeFormat()] || 'desconocido';
        return { code, format };
      }
    } catch (_) {
      // Área sin código legible: se prueba la siguiente.
    }
  }

  return null;
}