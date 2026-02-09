/**
 * Optimiza URLs de imágenes para performance móvil
 * Reduce tamaño, agrega lazy-loading, y formatos modernos
 * Whitelist: solo unsplash.com
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { imageUrl, width = 400, quality = 75 } = body;

    if (!imageUrl) {
      return Response.json(
        { error: 'imageUrl requerida' },
        { status: 400 }
      );
    }

    // Validar que sea URL de unsplash.com (whitelist estricta)
    try {
      const url = new URL(imageUrl);
      if (url.hostname !== 'images.unsplash.com' && url.hostname !== 'unsplash.com') {
        return Response.json(
          { error: 'Solo URLs de unsplash.com están permitidas' },
          { status: 400 }
        );
      }
    } catch (e) {
      return Response.json(
        { error: 'URL inválida' },
        { status: 400 }
      );
    }

    // Optimizar URL de unsplash
    return Response.json({
      original: imageUrl,
      optimized: `${imageUrl}?w=${width}&q=${quality}&auto=format&fit=max`,
      webp: `${imageUrl}?w=${width}&q=${quality}&auto=format&fit=max&fm=webp`,
      srcset: `${imageUrl}?w=${width}&q=${quality}&auto=format&fit=max 1x, ${imageUrl}?w=${width * 2}&q=${quality - 10}&auto=format&fit=max 2x`,
      loading: 'lazy',
      decoding: 'async'
    });
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});