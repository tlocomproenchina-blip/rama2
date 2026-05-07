// DESACTIVADA por solicitud del administrador para reducir consumo de créditos de integraciones.
// Esta función usaba Core.InvokeLLM con add_context_from_internet (alto costo) + Core.GenerateImage.
// Para reactivar, restaurar la implementación previa.
Deno.serve(async (_req) => {
  return Response.json({
    error: 'Función desactivada para reducir consumo de créditos de integraciones (LLM + internet + imagen IA).',
    disabled: true
  }, { status: 503 });
});