// Un solo envío a la impresora a la vez en este teléfono: los trabajos propios y los
// de la cola compartida esperan su turno y nunca se mezclan en la conexión Bluetooth.
let tail = Promise.resolve();

export const withPrinterLock = (fn) => {
  const run = tail.then(fn, fn);
  tail = run.catch(() => {});
  return run;
};