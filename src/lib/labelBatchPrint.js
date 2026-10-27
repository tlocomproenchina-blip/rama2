import { buildContinuousLabelPayload, concatUint8Arrays } from '@/lib/tspl';
import { bluetoothSupported, ensurePrinterConnected, writePayload } from '@/lib/thermalPrinter';

// Imprime la tira continua de un lote de cajas: una etiqueta por caja, numerada X/N y
// con el código QR de esa caja, su conteo de paquetes y su CBM. Reporta el avance por
// etiqueta para que la pantalla muestre cuál va saliendo.
// Si algo falla, lanza el error: quien llama decide (y no se crea ninguna guía).
export const printCajaLabelBatch = async ({ client = {}, cajas = [], emittedAt = '', onProgress }) => {
  if (!bluetoothSupported()) {
    throw new Error('La impresión Bluetooth solo funciona en Android (Chrome/WebView)');
  }
  const total = cajas.length;
  if (!total) throw new Error('El lote no tiene cajas');

  const payloads = cajas.map((caja, index) =>
    buildContinuousLabelPayload({
      client,
      index: Number(caja.caja_number) || index + 1,
      total: Number(caja.caja_total) || total,
      barcodeCode: caja.label_code || '',
      packageCount: Number(caja.package_count) || 0,
      cbm: Number(caja.cbm) || 0,
      emittedAt,
    })
  );

  // Los límites de bytes de cada etiqueta permiten informar cuál va saliendo.
  const boundaries = [];
  let accumulated = 0;
  payloads.forEach((payload) => {
    accumulated += payload.length;
    boundaries.push(accumulated);
  });

  await ensurePrinterConnected();
  await writePayload(concatUint8Arrays(payloads), (bytes) => {
    let done = 0;
    while (done < boundaries.length && boundaries[done] <= bytes) done += 1;
    onProgress?.(done, total);
  });

  return total;
};