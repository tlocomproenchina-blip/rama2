import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

// Reserva atómicamente un bloque de N números secuenciales de bulto para un dispositivo.
// Usa el contador global de ShippingMarkCounter (last_number) y lo incrementa en block_size.
// Devuelve { start, end, block_id, next_number }.
// El dispositivo usa estos números localmente (offline) y los asigna a bultos.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const blockSize = Math.min(Math.max(Number(body.block_size) || 50, 10), 200);
    const deviceId = String(body.device_id || '').trim() || 'unknown';

    // Obtener el contador global (registro único con config_key='main')
    const counters = await base44.asServiceRole.entities.ShippingMarkCounter.filter({ config_key: 'main' }, '-updated_date', 1);
    let counter = counters?.[0];
    if (!counter) {
      // Crear el contador si no existe (empieza en 49999, primer número real = 50000)
      counter = await base44.asServiceRole.entities.ShippingMarkCounter.create({
        config_key: 'main',
        last_number: 49999,
      });
    }

    const start = counter.last_number + 1;
    const end = start + blockSize - 1;

    // Incrementar atómicamente el contador
    await base44.asServiceRole.entities.ShippingMarkCounter.update(counter.id, {
      last_number: end,
    });

    const blockId = `block_${deviceId}_${Date.now()}`;

    return Response.json({
      start,
      end,
      block_id: blockId,
      next_number: start,
      block_size: blockSize,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}