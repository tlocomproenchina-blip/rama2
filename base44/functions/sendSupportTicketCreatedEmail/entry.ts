// DESACTIVADA por solicitud del administrador para reducir consumo de créditos de integraciones (emails).
// Esta función enviaba un email al cliente al crearse un ticket de soporte.
// La notificación in-app sigue funcionando vía createSupportTicketNotification.
// Para reactivar, restaurar la implementación previa.
Deno.serve(async (_req) => {
  return Response.json({
    error: 'Función desactivada para reducir consumo de créditos de integraciones (envío de emails).',
    disabled: true
  }, { status: 503 });
});