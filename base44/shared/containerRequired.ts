// Regla única: todo bulto o caja necesita al menos un N° de contenedor para guardarse.
// El N° de contenedor se guarda en cbm_order_numbers.

export const CONTAINER_REQUIRED_MESSAGE =
  'El N° de contenedor es obligatorio para guardar el bulto.';

export function cleanContainers(list: unknown): string[] {
  return (Array.isArray(list) ? list : [])
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);
}

export function hasContainer(list: unknown): boolean {
  return cleanContainers(list).length > 0;
}

// Respuesta estándar de rechazo (400) para que la pantalla muestre el aviso junto al campo
// y la cola de sincronización la deje para revisión en vez de reintentarla sola.
export function containerRequiredResponse(): Response {
  return Response.json(
    { error: CONTAINER_REQUIRED_MESSAGE, field: 'cbm_order_numbers' },
    { status: 400 }
  );
}