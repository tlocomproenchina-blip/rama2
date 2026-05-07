// DESACTIVADA por solicitud del administrador para reducir consumo de créditos de integraciones (emails).
// Esta función reenviaba emails urgentes para tickets sin respuesta del cliente en 48h.
// Para reactivar, restaurar la implementación previa.
Deno.serve(async (_req) => {
  return Response.json({
    error: 'Función desactivada para reducir consumo de créditos de integraciones (envío de emails).',
    disabled: true
  }, { status: 503 });
});