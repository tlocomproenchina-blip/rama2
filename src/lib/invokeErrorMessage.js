// Mensaje real que devuelve una función de backend cuando falla.
//
// El SDK lanza una excepción en las respuestas 4xx/5xx y el detalle del backend
// (por ejemplo "el abono supera el saldo pendiente") viaja dentro de esa
// excepción, no en la respuesta. Sin esto la pantalla solo mostraba un aviso
// genérico y el motivo real se perdía.
export function invokeErrorMessage(error, fallback) {
  const data = error?.response?.data || error?.data || null;
  const detail = data && typeof data === 'object' ? data.error : data;
  const text = String(detail || error?.message || '').trim();
  if (!text) return fallback;
  // Mensajes técnicos del cliente HTTP que no le dicen nada al administrador.
  if (/status code|Request failed|Network Error|TIMEOUT|Failed to fetch/i.test(text)) return fallback;
  return text;
}