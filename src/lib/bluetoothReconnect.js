// Reconexión Bluetooth de la impresora de etiquetas usando los permisos ya
// guardados por el navegador (navigator.bluetooth.getDevices()).
//
// ESTADO: STANDBY. RECONNECT_ENABLED está apagado a propósito hasta probar con
// la impresora física; mientras siga apagado, la impresión usa el flujo actual
// (requestDevice) sin ningún cambio de comportamiento.
//
// Cuando se active: si Android/Chrome devuelve una impresora ya autorizada, se
// reconecta por GATT sin diálogo; si no hay ninguna o falla, el flujo actual
// pide el dispositivo como siempre.
export const RECONNECT_ENABLED = false;

// Perfiles GATT usados por impresoras térmicas genéricas (POS-9250-L y similares).
export const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // genérico 0x18f0
  '0000ff00-0000-1000-8000-00805f9b34fb', // módulo FF00 (Xprinter y remarcados)
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Transparent UART (ISSC)
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae4-9fa8-5b5fef8f6bd7',
];

export const WRITE_CHARACTERISTICS = [
  '00002af1-0000-1000-8000-00805f9b34fb', // 0x2af1, par del 0x18f0
  '0000ff02-0000-1000-8000-00805f9b34fb', // 0xff02, par del 0xff00
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  '49535343-1e4d-4bd9-ba61-23c647249616',
];

const NAME_PREFIXES = ['POS', 'ZJ', 'Printer', 'MPT', 'Thermal', 'SPP'];

export const isPrinterName = (name) => {
  const upper = String(name || '').toUpperCase();
  if (!upper) return false;
  return NAME_PREFIXES.some((p) => upper.startsWith(p.toUpperCase())) || /PRINT|POS|ZJ|THERMAL/i.test(upper);
};

// getDevices() solo existe en Chrome/Android recientes y solo devuelve equipos
// que este sitio ya recibió permiso de usar; nunca abre el diálogo.
export const canReuseAuthorizedDevices = () =>
  RECONNECT_ENABLED &&
  typeof navigator !== 'undefined' &&
  typeof navigator.bluetooth?.getDevices === 'function';

export const findAuthorizedPrinter = async () => {
  if (!canReuseAuthorizedDevices()) return null;
  try {
    const devices = await navigator.bluetooth.getDevices();
    return devices.find((d) => isPrinterName(d?.name)) || null;
  } catch (_) {
    return null;
  }
};

// Diagnóstico para la prueba en vivo: devuelve los nombres ya autorizados.
export const listAuthorizedDevices = async () => {
  if (typeof navigator === 'undefined' || typeof navigator.bluetooth?.getDevices !== 'function') return [];
  try {
    const devices = await navigator.bluetooth.getDevices();
    return devices.map((d) => ({ name: d?.name || '', id: d?.id || '' }));
  } catch (_) {
    return [];
  }
};

export const findWriteCharacteristic = async (server) => {
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
    // Fallback: primera característica escribible del servicio
    try {
      const chars = await service.getCharacteristics();
      const writable = chars.find((c) => c.properties.write || c.properties.writeWithoutResponse);
      if (writable) return writable;
    } catch (_) {}
  }
  return null;
};

// Devuelve el dispositivo ya autorizado o pide permiso con el diálogo actual.
export const resolvePrinterDevice = async () => {
  const authorized = await findAuthorizedPrinter();
  if (authorized) return { device: authorized, reused: true };

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
  return { device, reused: false };
};

// Reconecta por GATT sin diálogo. Si el permiso no sirve o la impresora está
// apagada, devuelve null para que quien llama caiga al flujo normal.
export const connectAuthorizedPrinter = async () => {
  const device = await findAuthorizedPrinter();
  if (!device) return null;
  try {
    const server = device.gatt.connected ? device.gatt : await device.gatt.connect();
    const characteristic = await findWriteCharacteristic(server);
    if (!characteristic) return null;
    return { device, server, characteristic };
  } catch (_) {
    return null;
  }
};