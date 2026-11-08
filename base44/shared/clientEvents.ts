// Idempotencia de los eventos que llegan de la cola Store and Forward de bodega.
// El teléfono reenvía un evento si no recibió el acuse (red cortada a mitad de la
// respuesta). Con su id estable, el servidor reconoce el reintento y devuelve el
// mismo resultado sin volver a crear, contar o sumar nada.

const rowsOf = (res: any) => (Array.isArray(res) ? res : res?.items || []);

export function clientEventId(body: any): string {
  return String(body?.client_event_id || '').trim().slice(0, 200);
}

export async function findProcessedEvent(base44: any, eventId: string) {
  if (!eventId) return null;
  const res = await base44.asServiceRole.entities.ProcessedClientEvent
    .filter({ event_id: eventId }, '-created_date', 1)
    .catch(() => []);
  return rowsOf(res)[0] || null;
}

export function replayResponse(row: any): Response {
  return Response.json({ ...(row?.response || {}), replayed: true });
}

export async function rememberEvent(
  base44: any,
  { eventId, kind, user, body, response }: { eventId: string; kind: string; user: any; body: any; response: any },
) {
  if (!eventId) return;
  await base44.asServiceRole.entities.ProcessedClientEvent.create({
    event_id: eventId,
    kind,
    response,
    processed_by: user?.email || '',
    device_created_at: String(body?.device_created_at || ''),
  }).catch(() => null);
}