/**
 * Optimiza URLs de imágenes para performance móvil
 * Reduce tamaño, agrega lazy-loading, y formatos modernos
 */

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { imageUrl, width = 400, quality = 75 } = body;

    if (!imageUrl) {
      return Response.json(
        { error: 'imageUrl requerida' },
        { status: 400 }
      );
    }

    // Si la URL es de unsplash, optimizarla
    if (imageUrl.includes('unsplash.com')) {
      return Response.json({
        original: imageUrl,
        optimized: `${imageUrl}?w=${width}&q=${quality}&auto=format&fit=max`,
        webp: `${imageUrl}?w=${width}&q=${quality}&auto=format&fit=max&fm=webp`,
        srcset: `${imageUrl}?w=${width}&q=${quality}&auto=format&fit=max 1x, ${imageUrl}?w=${width * 2}&q=${quality - 10}&auto=format&fit=max 2x`,
        loading: 'lazy',
        decoding: 'async'
      });
    }

    // Para otras URLs, retornar con recomendaciones
    return Response.json({
      original: imageUrl,
      recommendations: {
        addSrcset: true,
        useLazyLoading: true,
        addWebPFormat: true,
        recommendedWidth: width,
        recommendedQuality: quality
      }
    });
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});