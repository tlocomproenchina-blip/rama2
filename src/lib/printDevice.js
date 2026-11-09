// Identidad de este teléfono para la cola compartida de impresión y la marca de
// "este teléfono es la estación" (sobrevive recargas).
const DEVICE_KEY = 'tlec-print-device-id';
const STATION_KEY = 'tlec-print-station-enabled';

export const getPrintDeviceId = () => {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch (_) {
    return 'dev_unknown';
  }
};

export const isStationEnabled = () => {
  try { return localStorage.getItem(STATION_KEY) === '1'; } catch (_) { return false; }
};

export const setStationEnabled = (on) => {
  try {
    if (on) localStorage.setItem(STATION_KEY, '1');
    else localStorage.removeItem(STATION_KEY);
  } catch (_) {}
};