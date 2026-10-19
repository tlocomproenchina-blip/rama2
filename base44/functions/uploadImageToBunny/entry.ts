import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { BunnyUploadError, uploadBase64ToBunny } from '../../shared/bunnyUpload.ts';

// Sube una imagen a Bunny Storage y devuelve la URL pública del CDN.
// Recibe: { image_base64: "...", filename?: "..." }
// Devuelve: { url }
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { image_base64 } = await req.json();
    if (!image_base64) {
      return Response.json({ error: 'image_base64 es requerido' }, { status: 400 });
    }

    const url = await uploadBase64ToBunny(String(image_base64));
    return Response.json({ url });
  } catch (error: any) {
    const status = error instanceof BunnyUploadError ? error.status : 500;
    return Response.json({ error: error.message }, { status });
  }
});