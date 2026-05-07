// DESACTIVADA por solicitud del administrador para reducir consumo de créditos de integraciones (emails de campañas).
// Esta función encolaba mensajes en EmailQueue para campañas de marketing.
// Para reactivar, restaurar la implementación previa.
Deno.serve(async (_req) => {
  return Response.json({
    error: 'Función desactivada para reducir consumo de créditos de integraciones (campañas de email).',
    disabled: true
  }, { status: 503 });
});