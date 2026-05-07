// DESACTIVADA por solicitud del administrador para reducir consumo de créditos de integraciones (emails).
// Esta función enviaba un email diario por cada cliente con actividad de las últimas 24h.
// La automatización scheduled asociada también fue archivada.
// Para reactivar, restaurar la implementación previa.
Deno.serve(async (_req) => {
  return Response.json({
    error: 'Función desactivada para reducir consumo de créditos de integraciones (envío masivo de emails).',
    disabled: true
  }, { status: 503 });
});