// Clasifica un fallo de envío para decidir qué hace la cola:
// - network: sin red o servidor saturado → se espera y se corta la ronda.
// - server: fallo temporal del servidor → se reintenta más tarde.
// - wait: el evento depende de otro que todavía no llega → se reintenta sin límite.
// - client: el servidor rechazó el dato → queda para revisión, sin reintentos solos.
// - logic: respuesta sin éxito → se reintenta; tras varios intentos queda para revisión.

export const conflictError = (message) => Object.assign(new Error(message), { conflict: true });
export const waitError = (message) => Object.assign(new Error(message), { wait: true });

export const statusOf = (e) => Number(e?.response?.status || e?.status || 0);

export function errorMessage(e) {
  return e?.response?.data?.error || e?.message || 'Error de red';
}

export function classifyError(e) {
  if (e?.conflict) return 'client';
  if (e?.wait) return 'wait';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'network';
  const status = statusOf(e);
  if (status === 429 || status === 401 || status === 408) return 'network';
  if (status >= 500) return 'server';
  if (status >= 400) return 'client';
  if (/network|fetch|timeout|aborted|Failed|CIRCUIT/i.test(errorMessage(e))) return 'network';
  return 'logic';
}

// Espera creciente entre intentos: 5 s, 10 s, 20 s… hasta 5 minutos.
export const backoffMs = (attempts) => Math.min(5000 * 2 ** Math.max(0, attempts - 1), 300000);