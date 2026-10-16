import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Páginas públicas estáticas del sitio (fuera del portal de clientes)
const STATIC_PUBLIC_PATHS = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/Blog', priority: '0.9', changefreq: 'daily' },
  { path: '/ShippingCalculator', priority: '0.8', changefreq: 'monthly' },
  { path: '/About', priority: '0.6', changefreq: 'monthly' },
  { path: '/Contact', priority: '0.6', changefreq: 'monthly' },
  { path: '/FAQ', priority: '0.6', changefreq: 'monthly' },
];

// 24 landing pages marítimas por ciudad (una por capital de estado)
const CITY_LANDING_SLUGS = [
  'caracas', 'maracaibo', 'valencia', 'maracay', 'barquisimeto', 'merida',
  'san-cristobal', 'barcelona', 'ciudad-bolivar', 'maturin', 'coro', 'barinas',
  'trujillo', 'guanare', 'san-juan-de-los-morros', 'san-fernando', 'cumana',
  'la-asuncion', 'puerto-ayacucho', 'tucupita', 'san-carlos', 'san-felipe',
  'los-teques', 'la-guaira'
];

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function resolveBaseUrl(req: Request, explicit?: string): string {
  if (explicit) return explicit.replace(/\/$/, '');
  // Intentar derivar desde headers del request
  try {
    const referer = req.headers.get('referer');
    if (referer) {
      const u = new URL(referer);
      return `${u.protocol}//${u.host}`;
    }
  } catch (_) {}
  try {
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    if (host) return `${proto}://${host}`;
  } catch (_) {}
  return 'https://tleccargo.com';
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);

    // Permit acceso público (sin auth) — el sitemap debe ser accesible por bots
    let baseUrl = resolveBaseUrl(req);
    try {
      const body = await req.json().catch(() => ({}));
      if (body?.baseUrl) baseUrl = resolveBaseUrl(req, body.baseUrl);
    } catch (_) {}

    // Obtener todos los blog posts publicados
    const posts = await base44.asServiceRole.entities.BlogPost.filter(
      { status: 'published' },
      '-published_at',
      500
    );

    const today = new Date().toISOString().split('T')[0];

    const staticUrls = STATIC_PUBLIC_PATHS.map((p) => `  <url>
     <loc>${escapeXml(baseUrl + p.path)}</loc>
     <lastmod>${today}</lastmod>
     <changefreq>${p.changefreq}</changefreq>
     <priority>${p.priority}</priority>
    </url>`).join('\n');

    const cityUrls = CITY_LANDING_SLUGS.map((slug) => `  <url>
     <loc>${escapeXml(baseUrl + '/envios-maritimos-china-' + slug)}</loc>
     <lastmod>${today}</lastmod>
     <changefreq>weekly</changefreq>
     <priority>0.8</priority>
    </url>`).join('\n');

    const postUrls = posts
      .filter((p) => p.slug)
      .map((p) => {
        const lastmod = p.published_at
          ? new Date(p.published_at).toISOString().split('T')[0]
          : today;
        const loc = `${baseUrl}/BlogPost?slug=${encodeURIComponent(p.slug)}`;
        return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
      })
      .join('\n');

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}
${cityUrls}
${postUrls}
</urlset>`;

    return new Response(sitemap, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}