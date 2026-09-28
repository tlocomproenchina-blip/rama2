import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Sube una imagen a Bunny Storage y devuelve la URL pública del CDN.
// Recibe: { image_base64: "...", filename?: "..." }
// Devuelve: { url }
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { image_base64, filename } = await req.json();
    if (!image_base64) {
      return Response.json({ error: 'image_base64 es requerido' }, { status: 400 });
    }

    const storageKey = Deno.env.get('BUNNY_STORAGE_KEY');
    const storageZone = Deno.env.get('BUNNY_STORAGE_ZONE');
    // Normalizar el host del CDN: puede venir con "https://" y/o con barra final,
    // lo que generaba enlaces con doble barra que no cargaban la foto.
    const cdnHost = String(Deno.env.get('BUNNY_CDN_HOST') || '')
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/, '');
    if (!storageKey || !storageZone || !cdnHost) {
      return Response.json({ error: 'Falta configuración de Bunny (key/zone/cdn host)' }, { status: 500 });
    }
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(cdnHost)) {
      return Response.json({ error: 'BUNNY_CDN_HOST inválido (solo el dominio, sin https:// ni barra final)' }, { status: 500 });
    }

    // Decodificar base64 a bytes
    const binary = atob(image_base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    // Generar ruta única: tlec/<timestamp>-<random>.jpg
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 10);
    const path = `tlec/${ts}-${rand}.jpg`;

    const uploadUrl = `https://storage.bunnycdn.com/${storageZone}/${path}`;
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': storageKey,
        'Content-Type': 'application/octet-stream',
      },
      body: bytes,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return Response.json({ error: `Error subiendo a Bunny (${res.status}): ${errText}` }, { status: 502 });
    }

    const publicUrl = `https://${cdnHost}/${path}`;
    // Validar la URL antes de entregarla: si queda mal formada, el paquete se
    // guardaría con una foto que nunca carga.
    try {
      const parsed = new URL(publicUrl);
      if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.pathname.startsWith('//')) {
        return Response.json({ error: 'URL de foto inválida' }, { status: 500 });
      }
    } catch (_) {
      return Response.json({ error: 'URL de foto inválida' }, { status: 500 });
    }
    return Response.json({ url: publicUrl });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});