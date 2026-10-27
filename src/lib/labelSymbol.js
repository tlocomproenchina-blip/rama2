import { qrToCanvas } from '@/lib/qrCode';

// Símbolo escaneable de la etiqueta: todas las etiquetas llevan código QR, también al
// reimprimir.
export async function labelSymbolImage(code) {
  const canvas = qrToCanvas(code, { moduleSize: 10, margin: 2 });
  return { data: canvas.toDataURL('image/png'), ratio: canvas.height / canvas.width, isQr: true };
}