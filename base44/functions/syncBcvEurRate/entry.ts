import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Tasa EUR del BCV. Sin auth (la invoca un workflow scheduled y el admin manualmente).
// Idempotente: si la tasa no cambió desde la última sync, no hace nada.
// Fallback multi-source: dolarvzla.com API → scraping bcv.org.ve.

function parseVenezuelanNumber(raw: string | null | undefined): number | null {
  if (!raw) return null;
  // Formato venezolano: "19,39949699" → 19.39949699
  const cleaned = String(raw).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

async function fetchFromDolarVzla(): Promise<{ rate: number; date: string | null } | null> {
  try {
    const res = await fetch('https://api.dolarvzla.com/v1/bcv', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Estructura esperada: { data: { euro: { value: "19,39" }, effective_date: "..." } }
    // o { euro: { value: "..." } } — ser flexibles
    const euro = data?.data?.euro || data?.euro;
    const rawValue = euro?.value || euro?.rate || euro?.price;
    const rate = parseVenezuelanNumber(rawValue);
    if (!rate || rate <= 0) return null;
    const date = data?.data?.effective_date || data?.effective_date || null;
    return { rate, date };
  } catch {
    return null;
  }
}

async function fetchFromBcvSite(): Promise<{ rate: number; date: string | null } | null>  {
  try {
    const res = await fetch('https://www.bcv.org.ve/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-VE,es;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    // El BCV muestra la tasa del euro en un bloque con "Euro" seguido de un <strong> con el valor
    // Buscar la sección del euro y extraer el valor numérico
    const euroSectionMatch = html.match(/Euro[\s\S]{0,800}?<strong[^>]*>\s*([\d.,]+)\s*<\/strong>/i);
    const rawValue = euroSectionMatch?.[1];
    const rate = parseVenezuelanNumber(rawValue);
    if (!rate || rate <= 0) return null;
    // Intentar extraer la fecha de actualización del BCV
    const dateMatch = html.match(/Actualizado[\s\S]{0,200}?(\d{2}\/\d{2}\/\d{4})/i);
    let date: string | null = null;
    if (dateMatch?.[1]) {
      const [d, m, y] = dateMatch[1].split('/');
      if (d && m && y) date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return { rate, date };
  } catch {
    return null;
  }
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Auth: admin o service-role (workflow scheduled invoca sin usuario)
    let isAdmin = false;
    try {
      const user = await base44.auth.me();
      if (user?.role === 'admin') isAdmin = true;
    } catch {}
    // Si no es admin, verificar si es una invocación interna (workflow) — permitir
    // Los workflows invocan con service role, auth.me() falla pero está OK

    // Cargar config actual
    const configs = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1);
    const config = configs?.[0];
    if (!config) {
      return Response.json({ error: 'AppConfig no encontrada' }, { status: 500 });
    }

    const previousRate = Number(config.bcv_eur_rate || 0);

    // Intentar fuentes en orden
    let result = await fetchFromDolarVzla();
    if (!result) result = await fetchFromBcvSite();

    if (!result) {
      return Response.json({
        status: 'error',
        message: 'No se pudo obtener la tasa EUR del BCV de ninguna fuente',
        previous_rate: previousRate,
      }, { status: 502 });
    }

    const { rate, date } = result;
    const today = new Date().toISOString().slice(0, 10);
    const effectiveDate = date || today;
    const nowIso = new Date().toISOString();

    // Idempotente: si la tasa es igual a la anterior y la fecha es la misma, no actualizar
    if (previousRate === rate && config.bcv_eur_rate_date === effectiveDate) {
      return Response.json({
        status: 'unchanged',
        rate,
        date: effectiveDate,
        last_sync: config.bcv_eur_rate_last_sync || nowIso,
        message: 'La tasa no ha cambiado desde la última sincronización',
      });
    }

    // Guardar nueva tasa
    await base44.asServiceRole.entities.AppConfig.update(config.id, {
      bcv_eur_rate: rate,
      bcv_eur_rate_date: effectiveDate,
      bcv_eur_rate_last_sync: nowIso,
    });

    const changed = previousRate > 0 && Math.abs(rate - previousRate) / previousRate > 0.001;

    return Response.json({
      status: 'updated',
      rate,
      date: effectiveDate,
      last_sync: nowIso,
      previous_rate: previousRate,
      changed,
      message: changed
        ? `Tasa EUR actualizada: ${rate} Bs (antes ${previousRate})`
        : `Tasa EUR sincronizada: ${rate} Bs`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}