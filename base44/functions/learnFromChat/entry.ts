// DESACTIVADA por solicitud del administrador para reducir consumo de créditos de integraciones.
// Esta función usaba Core.InvokeLLM para convertir Q&A en artículos de KB.
// Para reactivar, restaurar la implementación previa.
Deno.serve(async (_req) => {
  return Response.json({
    error: 'Función desactivada para reducir consumo de créditos de integraciones (LLM).',
    disabled: true
  }, { status: 503 });
});