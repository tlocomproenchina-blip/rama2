import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Registra o actualiza un dispositivo de bodega.
// Recibe: { device_id, alias? }
// - Si el dispositivo no existe, lo crea con alias auto-generado.
// - Si ya existe, actualiza last_activity, is_active y ubicación (IP geolocation).
// Retorna: { device, registered: boolean }

// Geolocaliza una IP usando ip-api.com (gratis, sin API key).
// Devuelve { city, country } o null si falla.
async function geolocateIp(ip: string): Promise<{ city: string; country: string } | null> {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.')) {
    return null;
  }
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city&lang=es`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 'success' || !data.country) return null;
    return { city: data.city || '', country: data.country || '' };
  } catch {
    return null;
  }
}

// Extrae la IP real del cliente desde los headers de la petición.
function getClientIp(req: Request): string {
  const headers = req.headers;
  const forwarded = headers.get('x-forwarded-for') || '';
  const first = forwarded.split(',')[0]?.trim();
  if (first) return first;
  return headers.get('x-real-ip') || headers.get('cf-connecting-ip') || '';
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const deviceId = String(body.device_id || '').trim();

    if (!deviceId) return Response.json({ error: 'device_id requerido' }, { status: 400 });

    const now = new Date().toISOString();
    const clientIp = getClientIp(req);
    const geo = await geolocateIp(clientIp);

    const devices = await base44.asServiceRole.entities.DispositivoBodega.filter(
      { device_id: deviceId }, '-created_date', 1
    );

    if (devices?.[0]) {
      const updateData: Record<string, any> = {
        last_activity: now,
        is_active: true,
      };
      if (geo) {
        updateData.last_city = geo.city;
        updateData.last_country = geo.country;
      }
      await base44.asServiceRole.entities.DispositivoBodega.update(devices[0].id, updateData);
      return Response.json({ device: devices[0], registered: false });
    }

    const alias = body.alias || `Dispositivo ${deviceId.slice(0, 8).toUpperCase()}`;
    const created = await base44.asServiceRole.entities.DispositivoBodega.create({
      device_id: deviceId,
      alias,
      last_activity: now,
      total_scans: 0,
      is_active: true,
      ...(geo ? { last_city: geo.city, last_country: geo.country } : {}),
    });

    return Response.json({ device: created, registered: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}