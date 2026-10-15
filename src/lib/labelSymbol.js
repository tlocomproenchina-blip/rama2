import { qrToCanvas } from '@/lib/qrCode';

// Símbolo escaneable de la etiqueta: las etiquetas nuevas llevan código QR y las
// reimpresiones de una etiqueta que ya salió impresa conservan el código de barras, para
// no alterar lo que ya está pegado en la carga.
export const isNewLabel = (bulto) => !(Number(bulto?.print_count) > 0);

// Imagen del símbolo lista para un PDF: { data, ratio, isQr }. El QR se dibuja cuadrado;
// el código de barras mantiene la proporción ancha de siempre.
export async function labelSymbolImage(code, { qr = false } = {}) {
  if (qr) {
    const canvas = qrToCanvas(code, { moduleSize: 10, margin: 2 });
    return { data: canvas.toDataURL('image/png'), ratio: canvas.height / canvas.width, isQr: true };
  }
  const JsBarcode = (await import('jsbarcode')).default;
  const canvas = document.createElement('canvas');
  JsBarcode(canvas, code, { format: 'CODE128', width: 4, height: 80, displayValue: true, fontSize: 18, margin: 0 });
  return { data: canvas.toDataURL('image/png'), ratio: canvas.height / canvas.width, isQr: false };
}