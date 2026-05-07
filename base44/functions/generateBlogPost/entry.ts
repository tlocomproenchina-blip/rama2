// DESACTIVADA por solicitud del administrador para reducir consumo de créditos de integraciones.
// Para reactivar, restaurar la implementación previa que usaba Core.InvokeLLM.
Deno.serve(async (_req) => {
  return Response.json({
    error: 'Función desactivada para reducir consumo de créditos de integraciones (LLM + búsqueda web).',
    disabled: true
  }, { status: 503 });
});