// DESACTIVADA por solicitud del administrador para reducir consumo de créditos de integraciones.
// Esta función usaba hasta 3 llamadas Core.InvokeLLM con internet + 2 Core.GenerateImage (muy alto costo).
// Para reactivar, restaurar la implementación previa.
Deno.serve(async (_req) => {
  return Response.json({
    error: 'Función desactivada para reducir consumo de créditos de integraciones (LLM x3 + 2 imágenes IA + internet).',
    disabled: true
  }, { status: 503 });
});