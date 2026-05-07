// DESACTIVADA por solicitud del administrador para reducir consumo de créditos de integraciones (emails).
// Esta función enviaba emails manuales solicitando comprobante de entrega.
// Para reactivar, restaurar la implementación previa.
Deno.serve(async (_req) => {
  return Response.json({
    error: 'Función desactivada para reducir consumo de créditos de integraciones (envío de emails).',
    disabled: true
  }, { status: 503 });
});