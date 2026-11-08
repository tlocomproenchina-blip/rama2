import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { BunnyUploadError, uploadBase64ToBunny } from '../../shared/bunnyUpload.ts';

// Sube una imagen a Bunny Storage y devuelve la URL pública del CDN.
// Recibe: { image_base64: "...", filename?: "..." }
// Devuelve: { url }
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { image_base64, ext, device_id } = await req.json().catch(() => ({}));
    if (!image_base64) {
      return Response.json({ error: 'image_base64 es requerido' }, { status: 400 });
    }

    // Solo usuarios con sesión o los dispositivos del almacén (enlace de trabajo
    // sin sesión, que siempre envía su device_id) pueden subir.
    const caller = await base44.auth.me().catch(() => null);
    if (!caller && !String(device_id || '').trim()) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = await uploadBase64ToBunny(String(image_base64), String(ext || 'jpg'));
    return Response.json({ url });
  } catch (error: any) {
    const status = error instanceof BunnyUploadError ? error.status : 500;
    return Response.json({ error: error.message }, { status });
  }
});