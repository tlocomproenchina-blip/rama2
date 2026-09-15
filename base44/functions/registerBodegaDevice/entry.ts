import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Registra o actualiza un dispositivo de bodega.
// Recibe: { device_id, alias? }
// - Si el dispositivo no existe, lo crea con alias auto-generado.
// - Si ya existe, actualiza last_activity e is_active.
// Retorna: { device, registered: boolean }
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const deviceId = String(body.device_id || '').trim();

    if (!deviceId) return Response.json({ error: 'device_id requerido' }, { status: 400 });

    const now = new Date().toISOString();
    const devices = await base44.asServiceRole.entities.DispositivoBodega.filter(
      { device_id: deviceId }, '-created_date', 1
    );

    if (devices?.[0]) {
      await base44.asServiceRole.entities.DispositivoBodega.update(devices[0].id, {
        last_activity: now,
        is_active: true,
      });
      return Response.json({ device: devices[0], registered: false });
    }

    const alias = body.alias || `Dispositivo ${deviceId.slice(0, 8).toUpperCase()}`;
    const created = await base44.asServiceRole.entities.DispositivoBodega.create({
      device_id: deviceId,
      alias,
      last_activity: now,
      total_scans: 0,
      is_active: true,
    });

    return Response.json({ device: created, registered: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}