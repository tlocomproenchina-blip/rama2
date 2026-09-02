import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// [DESCARTADA] IMGBB está desactivado. Todas las imágenes se suben a Bunny Storage
// vía la función `uploadImageToBunny`. Esta función se conserva solo para evitar
// romper referencias antiguas y devuelve siempre 410 Gone.
Deno.serve(async () => {
  return Response.json(
    { error: 'IMGBB está desactivado. Usa uploadImageToBunny para subir imágenes.' },
    { status: 410 }
  );
});