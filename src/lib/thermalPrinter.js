// Impresión térmica Bluetooth (BLE) compartida: mantiene la sesión abierta entre
// impresiones del mismo dispositivo y envía los datos por bloques de 180 bytes con
// una pausa entre bloques para no desbordar el buffer de la impresora.
// Mismas UUID y mismos tiempos que usa la impresión de etiquetas de bulto
// (POS-9250-L / ZJ-9250).
const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae4-9fa8-5b5fef8f6bd7',
];
const WRITE_CHARACTERISTICS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
];

const CHUNK_SIZE = 180;
const INTER_CHUNK_DELAY_MS = 80;

let session = { device: null, server: null, characteristic: null };

export const bluetoothSupported = () =>
  typeof navigator !== 'undefined' && !!navigator.bluetooth;

export const isPrinterConnected = () =>
  !!session.device?.gatt?.connected && !!session.characteristic;

const findWriteCharacteristic = async (server) => {
  for (const serviceUuid of PRINTER_SERVICES) {
    let service;
    try {
      service = await server.getPrimaryService(serviceUuid);
    } catch (_) {
      continue;
    }
    for (const charUuid of WRITE_CHARACTERISTICS) {
      try {
        const char = await service.getCharacteristic(charUuid);
        if (char && (char.properties.write || char.properties.writeWithoutResponse)) return char;
      } catch (_) {}
    }
    try {
      const chars = await service.getCharacteristics();
      const writable = chars.find((c) => c.properties.write || c.properties.writeWithoutResponse);
      if (writable) return writable;
    } catch (_) {}
  }
  return null;
};

// Conecta la impresora o reutiliza la sesión que ya está abierta.
export const ensurePrinterConnected = async () => {
  if (isPrinterConnected()) return session.characteristic;
  if (!bluetoothSupported()) throw new Error('Bluetooth no soportado en este navegador');

  const device = await navigator.bluetooth.requestDevice({
    filters: [
      { services: [PRINTER_SERVICES[0]] },
      { services: [PRINTER_SERVICES[1]] },
      { namePrefix: 'POS' },
      { namePrefix: 'ZJ' },
      { namePrefix: 'Printer' },
    ],
    optionalServices: PRINTER_SERVICES,
  });

  const server = await device.gatt.connect();
  const characteristic = await findWriteCharacteristic(server);
  if (!characteristic) {
    throw new Error('No se encontró una característica de escritura en la impresora');
  }
  session = { device, server, characteristic };
  return characteristic;
};

// Envía el payload completo. onProgress recibe los bytes ya escritos para que quien
// llama pueda reportar el avance (etiqueta X de N).
export const writePayload = async (data, onProgress) => {
  const characteristic = session.characteristic;
  if (!characteristic) throw new Error('Impresora no conectada');

  const canWriteWithResponse = !!characteristic.properties.write;
  const canWriteWithoutResponse = !!characteristic.properties.writeWithoutResponse;

  for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
    if (!session.device?.gatt?.connected) {
      throw new Error('Conexión Bluetooth perdida durante la impresión');
    }
    const chunk = data.slice(offset, offset + CHUNK_SIZE);
    try {
      if (canWriteWithResponse) await characteristic.writeValue(chunk);
      else if (canWriteWithoutResponse) await characteristic.writeValueWithoutResponse(chunk);
      else throw new Error('La característica no soporta escritura');
    } catch (e) {
      if (canWriteWithResponse && canWriteWithoutResponse) {
        await characteristic.writeValueWithoutResponse(chunk);
      } else {
        throw e;
      }
    }
    await new Promise((r) => setTimeout(r, INTER_CHUNK_DELAY_MS));
    onProgress?.(Math.min(offset + CHUNK_SIZE, data.length), data.length);
  }
};