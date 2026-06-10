import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Sube una imagen a ImgBB (gratis, sin consumir créditos de integraciones de Base44).
// Recibe: { image_base64: "..." } (solo el contenido base64, sin el prefijo data:)
// Devuelve: { url }
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { image_base64 } = await req.json();
    if (!image_base64) {
      return Response.json({ error: 'image_base64 es requerido' }, { status: 400 });
    }

    const apiKey = Deno.env.get('IMGBB_API_KEY');
    const form = new FormData();
    form.append('image', image_base64);

    const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: form,
    });

    const data = await res.json();
    if (!data?.success) {
      return Response.json({ error: data?.error?.message || 'Error subiendo imagen a ImgBB' }, { status: 502 });
    }

    return Response.json({ url: data.data.url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});